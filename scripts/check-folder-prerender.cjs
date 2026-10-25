// Render the real folder routes on the server, with only session/router mocked.
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

async function main() {
  const root = path.resolve(__dirname, '..');
  const result = await esbuild.build({
    stdin: {
      contents: `
        import React from 'react';
        import { renderToString } from 'react-dom/server';
        import Layout from './src/app/designer/folders/layout';
        import Index from './src/app/designer/folders/page';
        import Detail from './src/app/designer/folders/[id]/page';
        export function render(detail, wrapped) {
          const page = React.createElement(detail ? Detail : Index);
          return renderToString(wrapped ? React.createElement(Layout, null, page) : page);
        }
      `,
      resolveDir: root, loader: 'tsx',
    },
    bundle: true, write: false, platform: 'node', format: 'cjs', jsx: 'automatic',
    packages: 'external', alias: { '@': path.join(root, 'src') },
    plugins: [{ name: 'request-boundaries', setup(build) {
      build.onResolve({ filter: /^(next-auth\/react|next\/navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents:
        args.path === 'next-auth/react'
          ? 'export const useSession=()=>({data:null,status:"loading"});'
          : 'export const useRouter=()=>({push(){}});export const useParams=()=>({id:"fixture-folder"});',
      }));
    } }],
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
  for (const detail of [false, true]) {
    assert.throws(() => mod.exports.render(detail, false), /useProjectFolder must be used within/);
    assert.ok(mod.exports.render(detail, true).length > 0);
  }
  console.log('PASS: folder index/detail reproduce missing-provider error and render with route layout.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
