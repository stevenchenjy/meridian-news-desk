// Bundled guides keep background reading available before the local API loads.
// Daily research overrides and additions arrive through data.background.guides.
const modules = import.meta.glob('../../config/background-*.json', { import: 'default' });
const starters = ['israel-palestine', 'us-iran', 'trump-administration'];
export async function loadBundledBackgroundGuides() {
  const guides = await Promise.all(Object.values(modules).map(load => load()));
  return guides.sort((a, b) => {
    const rank = guide => starters.includes(guide.id) ? starters.indexOf(guide.id) : starters.length;
    return rank(a) - rank(b) || a.id.localeCompare(b.id);
  });
}
