import {readFileSync} from 'node:fs';
/** Bundles the authoritative public JSON without duplicating it or importing a public URL as JS. */
export function artCatalog() {
  return {
    name:'apartman-art-catalog',
    resolveId(id) { if (id === 'virtual:apartman-art-catalog') return '\0apartman-art-catalog'; },
    load(id) {
      if (id !== '\0apartman-art-catalog') return;
      const read = path => JSON.stringify(JSON.parse(readFileSync(new URL('../public/art/v2/'+path,import.meta.url),'utf8')));
      return `export const anchors=${read('apartment-anchors.json')};export const avatars=${read('avatars/manifest.json')};`;
    },
  };
}
