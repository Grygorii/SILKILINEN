import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
const require=createRequire(import.meta.url), mongoose=require('mongoose'), express=require('express'), cookieParser=require('cookie-parser'), jwt=require('jsonwebtoken');
const Visit=require('../models/Visit'), Event=require('../models/Event'), Order=require('../models/Order'), Product=require('../models/Product'), SystemState=require('../models/SystemState'), GrowthAction=require('../models/GrowthAction'), CEOBrief=require('../models/CEOBrief'), Composition=require('../models/DaVinciComposition'), AnalyticsExclusion=require('../models/AnalyticsExclusion');
const {loadEvidence}=require('../services/commerceEvidence');
const {withWorkflowLease}=require('../services/workflowLease');
const engine=require('../services/growthEngine'), watchdog=require('../services/growthAgents/watchdog');
const ai=require('../services/aiClient'), auditor=require('../services/groundTruthAuditor');
const chief=require('../services/chiefOfStaff');
const davinci=require('../services/davinci');
const dashboard=require('../routes/adminDashboard'), growth=require('../routes/adminGrowth'), insights=require('../routes/insights'), track=require('../routes/track'), {csrf}=require('../middleware/csrf');
let db,server,base;
const models=[Visit,Event,Order,Product,SystemState,GrowthAction,CEOBrief,Composition,AnalyticsExclusion];
const cookie=`token=${jwt.sign({role:'admin',userId:'012345678901234567890123'},process.env.JWT_SECRET)}`;
const http=(path,body)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json','X-CSRF-Token':'1'},...(body?{body:JSON.stringify(body)}:{})});
beforeAll(async()=>{db=await MongoMemoryReplSet.create({binary:{version:'7.0.24'},replSet:{count:1}});await mongoose.connect(db.getUri(),{dbName:'reporting_fixture'});await Promise.all(models.map(m=>m.init()));const app=express();app.use(express.json());app.use(cookieParser());app.use(csrf);app.use('/api/admin/dashboard',dashboard);app.use('/api/admin/growth',growth);app.use('/api/admin/insights',insights);app.use('/api/track',track);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;});
afterAll(async()=>{if(server)await new Promise(r=>server.close(r));await mongoose.disconnect();if(db)await db.stop();vi.restoreAllMocks();});
beforeEach(async()=>{await Promise.all(models.map(m=>m.deleteMany({})));vi.restoreAllMocks();});
describe('database to API',()=>{
 it('shows ledger sales and missing attribution without buyer identity',async()=>{
  await Visit.create({sessionId:'fixture-browser',page:'product',source:'google',createdAt:new Date(Date.now()-3600000)});
  await Order.create({orderNumber:'FIXTURE-ONE',status:'shipped',total:178,customerEmail:'private@example.test',customerName:'Private Fixture',createdAt:new Date(Date.now()-600000)});
  await loadEvidence(30,{fresh:true});await loadEvidence(14,{fresh:true});await loadEvidence(14,{fresh:true,offsetDays:14});
  const response=await http('/api/admin/dashboard');expect(response.status).toBe(200);const d=await response.json();
  expect(d.zone3_whatIsWorking.attribution.summary).toMatchObject({orders:1,netRevenueEUR:178,unlinkedOrders:1,conversionPercent:null});expect(JSON.stringify(d.zone3_whatIsWorking.attribution)).not.toMatch(/private@example|Private Fixture/);
  const f=await(await http('/api/admin/dashboard/funnel?days=14')).json();expect(f.overallConversion).toBeNull();expect(f.evidence.summary.orders).toBe(1);expect(f.stages.find(s=>s.key==='viewedProduct').count).toBe(1);expect(f.biggestLeak).toBeNull();
 });
 it('counts a new linked sale without a success-page event',async()=>{await Visit.create({sessionId:'linked-fixture',page:'product',source:'pinterest',createdAt:new Date(Date.now()-3600000)});await Order.create({browserSessionId:'linked-fixture',status:'processing',total:89,createdAt:new Date(Date.now()-600000)});const e=await loadEvidence(30,{fresh:true});expect(e.summary).toMatchObject({linkedOrders:1,orders:1,netRevenueEUR:89});expect(e.stage.purchased.size).toBe(1);});
 it('removes only the chosen browser from replay evidence and blocks a late beacon',async()=>{
  const now=Date.now(), ownerSession='owner-browser-to-exclude', customerSession='customer-browser-to-keep';
  await Visit.create([
   {sessionId:ownerSession,page:'/product/owner',source:'direct',createdAt:new Date(now-30*60000)},
   {sessionId:customerSession,page:'/product/customer',source:'google',createdAt:new Date(now-20*60000)},
  ]);
  await Event.create([
   {sessionId:ownerSession,type:'view_item',createdAt:new Date(now-29*60000)},
   {sessionId:ownerSession,type:'search',props:{search_term:'owner only'},createdAt:new Date(now-28*60000)},
   {sessionId:customerSession,type:'view_item',createdAt:new Date(now-19*60000)},
   {sessionId:customerSession,type:'search',props:{search_term:'customer search'},createdAt:new Date(now-18*60000)},
  ]);
  await Order.create({browserSessionId:ownerSession,status:'paid',total:89,createdAt:new Date(now-10*60000)});
  const warm=await loadEvidence(7,{fresh:true});expect(warm.browsers.size).toBe(2);

  const response=await http('/api/admin/insights/journeys/exclude-browser-session',{sessionId:ownerSession});
  expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,removed:{visits:1,events:2}});
  expect(await Visit.countDocuments({sessionId:ownerSession})).toBe(0);
  expect(await Event.countDocuments({sessionId:ownerSession})).toBe(0);
  expect(await Order.countDocuments({browserSessionId:ownerSession})).toBe(1);

  const after=await loadEvidence(7);
  expect(after.browsers.has(ownerSession)).toBe(false);expect(after.browsers.has(customerSession)).toBe(true);
  expect(after.summary).toMatchObject({orders:1,linkedOrders:0,unlinkedOrders:1});
  const journeys=await (await http('/api/admin/insights/journeys?days=7')).json();
  expect(journeys.topSearches.map(search=>search.term)).not.toContain('owner only');
  expect(journeys.topSearches.map(search=>search.term)).toContain('customer search');

  const late=await http('/api/track/event',{sessionId:ownerSession,type:'view_item'});
  expect(late.status).toBe(200);expect(await Event.countDocuments({sessionId:ownerSession})).toBe(0);
 });
 it('protects browser exclusion and validates its identifier',async()=>{
  const anonymous=await fetch(base+'/api/admin/insights/journeys/exclude-browser-session',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':'1'},body:JSON.stringify({sessionId:'owner-browser'})});
  expect(anonymous.status).toBe(401);
  const invalid=await http('/api/admin/insights/journeys/exclude-browser-session',{sessionId:' '});
  expect(invalid.status).toBe(400);
 });
 it('reconciles ledger-paid, raw purchase-page, manual and visit-only journey evidence',async()=>{
  const now=Date.now(), paidSession='journey-paid-browser', incompleteSession='journey-incomplete-browser', visitOnlySession='journey-visit-only-browser', orphanSession='journey-orphan-event';
  await Visit.create([
   {sessionId:paidSession,page:'/product/fixture',source:'google',createdAt:new Date(now-60*60000)},
   {sessionId:incompleteSession,page:'/product/fixture',source:'google',createdAt:new Date(now-40*60000)},
   {sessionId:visitOnlySession,page:'/product/fixture',source:'google',createdAt:new Date(now-20*60000)},
  ]);
  await Event.create([
   {sessionId:paidSession,type:'view_item',createdAt:new Date(now-55*60000)},
   {sessionId:paidSession,type:'add_to_cart',createdAt:new Date(now-50*60000)},
   {sessionId:paidSession,type:'view_item',props:{probe:'out-of-range'},createdAt:new Date(now-8*86400000)},
   {sessionId:incompleteSession,type:'reached_payment',createdAt:new Date(now-30*60000)},
   {sessionId:incompleteSession,type:'purchase',createdAt:new Date(now-29*60000)},
   {sessionId:orphanSession,type:'add_to_cart',createdAt:new Date(now-25*60000)},
  ]);
  await Order.create({orderNumber:'JOURNEY-PAID',browserSessionId:paidSession,status:'paid',total:89,createdAt:new Date(now-15*60000)});
  await Order.create({orderNumber:'JOURNEY-MANUAL',status:'paid',total:45,attribution:{source:'manual',medium:'admin'},createdAt:new Date(now-10*60000)});
  expect(await Event.countDocuments({sessionId:paidSession,type:'purchase'})).toBe(0);
  await loadEvidence(7,{fresh:true});

  const incomplete=await http('/api/admin/insights/journeys?days=7'); expect(incomplete.status).toBe(200);
  const incompleteData=await incomplete.json();
  expect(incompleteData.reporting).toMatchObject({paidOrders:2,linkedOrders:1,unlinkedOrders:0,manualOrders:1,netRevenueEUR:134});
  expect(incompleteData.funnel.find(stage=>stage.key==='purchased')).toMatchObject({sessions:1});
  expect(incompleteData.outcome).toBe('abandoned');
  expect(incompleteData.journeys.map(journey=>journey.sessionId)).toContain(incompleteSession);
  expect(incompleteData.journeys.map(journey=>journey.sessionId)).not.toContain(paidSession);
  expect(incompleteData.journeys.map(journey=>journey.sessionId)).not.toContain(orphanSession);
  expect(incompleteData.journeys.find(journey=>journey.sessionId===incompleteSession).steps.map(step=>step.type)).toContain('purchase');

  const viewOnly=await http('/api/admin/insights/journeys?days=7&stage=view_item'); expect(viewOnly.status).toBe(200);
  const viewOnlyData=await viewOnly.json();
  const visitOnlyJourney=viewOnlyData.journeys.find(journey=>journey.sessionId===visitOnlySession);
  expect(visitOnlyJourney).toBeTruthy();
  expect(visitOnlyJourney.steps.map(step=>step.type)).toContain('page_view');

  const paymentLeak=await http('/api/admin/insights/journeys?days=7&stage=reached_payment'); expect(paymentLeak.status).toBe(200);
  expect((await paymentLeak.json()).journeys.map(journey=>journey.sessionId)).toContain(incompleteSession);

  const completed=await http('/api/admin/insights/journeys?days=7&outcome=purchased'); expect(completed.status).toBe(200);
  const completedData=await completed.json();
  const paidJourney=completedData.journeys.find(journey=>journey.sessionId===paidSession);
  expect(completedData.outcome).toBe('purchased'); expect(paidJourney).toBeTruthy();
  expect(paidJourney.steps.map(step=>step.type)).toContain('paid_order');
  expect(paidJourney.steps.some(step=>step.props?.probe==='out-of-range')).toBe(false);
 });
 it('replays the latest forty chronological breadcrumbs, rather than the oldest history',async()=>{
  const now=Date.now(), sessionId='journey-latest-breadcrumbs';
  await Visit.create({sessionId,page:'/product/fixture',source:'google',createdAt:new Date(now-100*60000)});
  await Event.insertMany(Array.from({length:45},(_,index)=>({
   sessionId,type:'view_item',props:{index},createdAt:new Date(now-(90-index)*60000),
  })));
  await loadEvidence(7,{fresh:true});

  const response=await http('/api/admin/insights/journeys?days=7&stage=view_item');
  expect(response.status).toBe(200);
  const journey=(await response.json()).journeys.find(item=>item.sessionId===sessionId);
  expect(journey.steps).toHaveLength(40);
  expect(journey.steps.map(step=>step.props?.index)).toEqual(Array.from({length:40},(_,index)=>index+5));
  expect(journey.steps.map(step=>new Date(step.createdAt).getTime())).toEqual([...journey.steps]
   .sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt))
   .map(step=>new Date(step.createdAt).getTime()));
 });
 it('serves current evidence without generating AI or writing orders',async()=>{await Composition.create({vision:'Historical strategy',createdAt:new Date('2026-06-19')});await GrowthAction.create({agent:'fixture',type:'idea',title:'Old idea',status:'needs_approval',createdAt:new Date(Date.now()-45*86400000)});await loadEvidence(30,{fresh:true});const response=await http('/api/admin/growth/evidence');expect(response.status).toBe(200);const e=await response.json();expect(e.composition.status).toBe('stale');expect(e.queue).toMatchObject({total:1,olderThan30Days:1});expect(await Order.countDocuments()).toBe(0);expect(await CEOBrief.countDocuments()).toBe(0);});
 it('retrieves Hermes work even beyond the global fifty-row feed',async()=>{await GrowthAction.create({agent:'hermes',type:'seo',title:'Targeted SEO',status:'needs_approval',createdAt:new Date(Date.now()-86400000)});await GrowthAction.insertMany(Array.from({length:55},(_,i)=>({agent:'social',type:'info',title:`Other ${i}`})));const e=await(await http('/api/admin/growth?agent=hermes')).json();expect(e.actions).toHaveLength(1);expect(e.actions[0].agent).toBe('hermes');});
 it('does not expose reporting publicly',async()=>{expect((await fetch(base+'/api/admin/growth/evidence')).status).toBe(401);});
});
describe('agent execution',()=>{
 it('serializes concurrent callers and releases after failure',async()=>{let release;const wait=new Promise(r=>{release=r});const first=withWorkflowLease('fixture',async()=>{await wait;return{done:true}});for(let i=0;i<50&&!await SystemState.exists({key:'workflowLease:fixture'});i++)await new Promise(r=>setTimeout(r,10));expect(await withWorkflowLease('fixture',async()=>({bad:true}))).toEqual({busy:true});release();expect(await first).toEqual({done:true});await expect(withWorkflowLease('fixture',async()=>{throw Error('fixture failure')})).rejects.toThrow('fixture failure');expect(await withWorkflowLease('fixture',async()=>({again:true}))).toEqual({again:true});});
 it('marks soft AI failures degraded without recording a successful run',async()=>{await engine.setAgentEnabled('watchdog',true);vi.spyOn(watchdog,'run').mockResolvedValue([{type:'info',status:'info',title:"Couldn't reach the data source this run"}]);const result=await engine.runGrowthEngine({force:true,only:'watchdog'});expect(result.ran).toEqual([]);expect(result.failed).toHaveLength(1);const agent=(await engine.describeAgents()).find(a=>a.name==='watchdog');expect(agent.lastRun).toBeNull();expect(agent.lastAttempt.status).toBe('degraded');expect((await GrowthAction.findOne()).status).toBe('error');});
 it('backs off failures then retries without waiting a full cadence',async()=>{await engine.setAgentEnabled('watchdog',true);const run=vi.spyOn(watchdog,'run').mockRejectedValue(new Error('fixture failure'));await engine.runGrowthEngine({force:true,only:'watchdog'});run.mockResolvedValue([{type:'info',title:'Checked successfully',status:'info'}]);expect((await engine.runGrowthEngine({only:'watchdog'})).skipped).toContain('watchdog');await SystemState.updateOne({key:'growthEngineAttempts'},{$set:{'value.watchdog.at':new Date(Date.now()-7200000).toISOString()}});expect((await engine.runGrowthEngine({only:'watchdog'})).ran).toEqual(['watchdog']);});
 it('does not duplicate an identical unresolved recommendation',async()=>{await engine.setAgentEnabled('watchdog',true);vi.spyOn(watchdog,'run').mockResolvedValue([{type:'alert',title:'Same unresolved task',status:'needs_approval'}]);await engine.runGrowthEngine({force:true,only:'watchdog'});await engine.runGrowthEngine({force:true,only:'watchdog'});expect(await GrowthAction.countDocuments({title:'Same unresolved task'})).toBe(1);});
 it('validates agent names and preserves other settings',async()=>{await engine.setAgentEnabled('watchdog',false);await engine.setAgentEnabled('hermes',true);expect((await engine.getSettings()).watchdog.enabled).toBe(false);await expect(engine.runGrowthEngine({only:'not-an-agent'})).rejects.toThrow('Unknown');});
});

describe('AI generation wiring with provider fixtures',()=>{
 it('generates a data-grounded brief and strategy without secretly running all agents',async()=>{
  process.env.DEEPSEEK_API_KEY='fixture-provider-key-not-used';
  await Product.collection.insertOne({name:'Fixture product',price:89,status:'active',slug:'fixture'});
  await Order.create({orderNumber:'FIXTURE-AI',status:'paid',total:89,createdAt:new Date(Date.now()-60000)});
  await loadEvidence(30,{fresh:true});await loadEvidence(14,{fresh:true});await loadEvidence(14,{fresh:true,offsetDays:14});
  vi.spyOn(auditor,'auditText').mockResolvedValue({findings:[]});
  const calls=[];
  vi.spyOn(ai.chat.completions,'create').mockImplementation(async args=>{
    calls.push(args);
    const strategy=args.messages[0].content.includes('practical luxury-commerce strategist');
    return {choices:[{message:{content:JSON.stringify(strategy?{vision:'Verify the unknown source, improve one page, then review outcomes.',grandIdea:{title:'Evidence before expansion',what:'One measured test',why:'Small sample'},movements:[{title:'Measure',theme:'Coverage',moves:['Check the next order link; measure coverage after seven days.']},{title:'Improve',theme:'Product clarity',moves:['Review sizing; compare recorded cart additions over four weeks.']},{title:'Review',theme:'Evidence',moves:['Read ledger orders and unknown sources after four weeks.']}],closing:'No promised sales uplift.'}:{headline:'One recorded purchase; its source is unknown.',progress:'Measurement first.',whatChanged:'No causal claim.',whatsWorking:'The ledger is recording sales.',marketRead:'No market conclusion from one order.',moves:[],founderActions:['Check attribution'],buildIdeas:[],learnings:['A proposed hypothesis, not a fact.']})}}]};
  });
  const before=await SystemState.countDocuments({key:'growthEngineLastRun'});
  const response=await http('/api/admin/growth/davinci',{});
  if(response.status!==200) console.log('strategy fixture response',await response.clone().text());
  expect(response.status).toBe(200);expect(await Composition.countDocuments()).toBe(1);
  expect(await SystemState.countDocuments({key:'growthEngineLastRun'})).toBe(before);
  expect(calls.length).toBeGreaterThanOrEqual(1);
  expect(calls.some(call=>call.messages.some(message=>message.content.includes('COMMERCE EVIDENCE')))).toBe(true);
  expect(await GrowthAction.countDocuments({type:'learning_review',status:'needs_approval'})).toBeGreaterThanOrEqual(1);
  delete process.env.DEEPSEEK_API_KEY;
 });
 it('does not consume the weekly slot when AI is not configured',async()=>{
  delete process.env.DEEPSEEK_API_KEY;
  const result=await chief.runChiefIfDue({force:true});expect(result.ran).toBe(false);
  expect(await SystemState.countDocuments({key:'chiefOfStaffLastRun'})).toBe(0);
 });
});
