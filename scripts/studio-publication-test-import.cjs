const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript'), React = require('react');
/** Pure publication renderers used by the existing VM-based UI harnesses. */
module.exports = function publicationImport(name) {
  const files = {
    './publication-headlines': 'src/lib/publishing-studio/publication-headlines.ts',
    '@/lib/publishing-studio/publication-headlines': 'src/lib/publishing-studio/publication-headlines.ts',
    './history': 'src/lib/publishing-studio/history.ts',
    './StudioPublicationHistory': 'src/components/publishing-studio/StudioPublicationHistory.tsx',
    './StudioPitchCard': 'src/components/publishing-studio/StudioPitchCard.tsx',
    './StudioPublicationCard': 'src/components/publishing-studio/StudioPublicationCard.tsx',
    '../StudioPublicationCard': 'src/components/publishing-studio/StudioPublicationCard.tsx',
    './ActivityArticleCover': 'src/components/publishing-studio/ActivityArticleCover.tsx',
    './ExpertiseArticleCover': 'src/components/publishing-studio/expertise/ExpertiseArticleCover.tsx',
    '@/components/instagram-export/CarouselHero': 'src/components/instagram-export/CarouselHero.tsx',
    '@/lib/instagram-export/svg-templates': 'src/lib/instagram-export/svg-templates.ts',
    './StudioWorkspace': 'src/components/publishing-studio/StudioWorkspace.tsx',
  };
  if (!files[name]) return undefined;
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(files[name], 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText, {
    exports, window: global.window, document: global.document, fetch: (...args) => global.fetch(...args), require: id => id === 'next/link' ? {default:({children,...props})=>React.createElement('a',props,children)} : publicationImport(id) || require(id),
  });
  return exports;
};
