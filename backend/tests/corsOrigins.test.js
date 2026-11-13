import { describe, expect, it } from 'vitest';
import corsOrigins from '../utils/corsOrigins.js';

const { isSilkilinenVercelDeployment } = corsOrigins;

describe('Vercel deployment CORS origin', () => {
  it('allows only this shop’s Vercel project URLs', () => {
    expect(isSilkilinenVercelDeployment('https://silkilinen-4nhujw84g-grishakinzerskyi-1780s-projects.vercel.app')).toBe(true);
    expect(isSilkilinenVercelDeployment('https://silkilinen-git-master-grishakinzerskyi-1780s-projects.vercel.app')).toBe(true);
    expect(isSilkilinenVercelDeployment('https://silkilinen.vercel.app')).toBe(true);
  });

  it('does not turn credentialed CORS into a wildcard Vercel allow-list', () => {
    expect(isSilkilinenVercelDeployment('http://silkilinen-git-master-grishakinzerskyi-1780s-projects.vercel.app')).toBe(false);
    expect(isSilkilinenVercelDeployment('https://silkilinen-git-master-grishakinzerskyi-1780s-projects.vercel.app.evil.test')).toBe(false);
    expect(isSilkilinenVercelDeployment('https://another-shop-git-master-grishakinzerskyi-1780s-projects.vercel.app')).toBe(false);
  });
});
