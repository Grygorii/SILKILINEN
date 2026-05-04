const IMAGE_SLOTS = [
  { key: 'hero',      label: 'Hero',      description: 'Main listing photo', required: true  },
  { key: 'front',     label: 'Front',     description: 'Front view'                          },
  { key: 'back',      label: 'Back',      description: 'Back view'                           },
  { key: 'side',      label: 'Side',      description: 'Side profile'                        },
  { key: 'detail',    label: 'Detail',    description: 'Fabric close-up'                     },
  { key: 'lifestyle', label: 'Lifestyle', description: 'Model or scene'                      },
  { key: 'thumbnail', label: 'Thumbnail', description: 'Cart thumbnail'                      },
];
const SLOT_KEYS = IMAGE_SLOTS.map(s => s.key);
module.exports = { IMAGE_SLOTS, SLOT_KEYS };
