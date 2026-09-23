const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript'), React = require('react');
/** Pure publication renderers used by the existing VM-based UI harnesses. */
module.exports = function publicationImport(name) {
  const files = {
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
    exports, require: id => id === 'next/link' ? {default:({children,...props})=>React.createElement('a',props,children)} : publicationImport(id) || require(id),
  });
  return exports;
};
