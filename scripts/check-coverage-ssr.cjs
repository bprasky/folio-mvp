// Render actual profile feeds without a browser to verify first-response discovery links.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),esbuild=require('esbuild');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/coverage-ssr.cjs');fs.mkdirSync(path.dirname(out),{recursive:true});
const source=`import React from 'react';import{renderToStaticMarkup}from'react-dom/server';
import { StudioProfileTools } from './src/components/org-profile/StudioProfileTools';
import { OrgAboutTab } from './src/components/org-onboarding/OrgAboutTab';
import ProfileFeed from './src/components/profile/unified/ProfileFeed';
import OrgProfileFeed from './src/components/org-profile/OrgProfileFeed';
import{ProfileDetails}from'./src/components/profile/ProfileDetails';
import{ProjectStructuredData}from'./src/components/coverage/ProjectStructuredData';
const item={id:'coverage',type:'recognition',publishedAt:'2026-11-01',pinnedAt:null,engagement:0,data:{coverage:{id:'coverage',title:'Courtyard House',source:'Design Journal',url:'https://press.example/story',category:'interview',publicationDate:null,imageUrl:null,project:{title:'Courtyard House',href:'/project/house?view=public'}}}};
export const person=renderToStaticMarkup(<ProfileFeed userId="designer" initialItems={[item]}/>);
export const studio=renderToStaticMarkup(<OrgProfileFeed orgId="studio" initialItems={[item]} initialFilter="all" initialSort="featured"/>);
const next={title:'Review your website import',description:'Choose your photographs.',href:'/onboarding/workspace?import=saved',action:'Open import'};
export const setup=renderToStaticMarkup(<StudioProfileTools orgId="studio" isAdmin canInvite next={next}>Team notices</StudioProfileTools>);
export const complete=renderToStaticMarkup(<StudioProfileTools orgId="studio" isAdmin canInvite next={null}>Team notices</StudioProfileTools>);
export const contributor=renderToStaticMarkup(<StudioProfileTools orgId="studio" isAdmin={false} canInvite={false} next={next}/>);
export const ownerAbout=renderToStaticMarkup(<OrgAboutTab org={{id:'studio',name:'Studio',description:'Saved studio biography',specialties:['Courtyard homes']}} team={[]} isOwner/>);
export const publicAbout=renderToStaticMarkup(<OrgAboutTab org={{id:'studio',name:'Studio',description:'Saved studio biography'}} team={[]} isOwner={false}/>);
export const details=renderToStaticMarkup(<ProfileDetails name="Studio" description="Miami courtyard interiors" specialties={['Natural stone']} organization/>);
export const structured=renderToStaticMarkup(<ProjectStructuredData project={{id:'house',title:'</script><script>evil</script>',designerOrg:{id:'studio',name:'Studio'}}}/>);`;
(async()=>{await esbuild.build({stdin:{contents:source,loader:'tsx',resolveDir:root},bundle:true,outfile:out,platform:'node',format:'cjs',jsx:'automatic',external:['react','react-dom/server'],alias:{'@':path.join(root,'src')},plugins:[{name:'framework-boundaries',setup(b){
  b.onResolve({filter:/\.module\.css$|^next\/(navigation|link|image)$|^next-auth\/react$/},a=>({path:a.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'tsx',resolveDir:root,contents:a.path.endsWith('.css')?`export default new Proxy({},{get:(_,k)=>String(k)});`:a.path==='next/navigation'?`export const useRouter=()=>({push(){},replace(){},refresh(){}});export const useSearchParams=()=>new URLSearchParams();export const usePathname=()=>'/profile/owner';`:a.path==='next-auth/react'?`export const useSession=()=>({data:null,status:'unauthenticated'});`:`import React from'react';export default({children,href,...p})=>href?<a href={href}>{children}</a>:<img {...p}/>;`}));
}}]});const result=require(out);for(const key of ['person','studio']){assert.match(result[key],/href="https:\/\/press.example\/story"/);assert.match(result[key],/href="\/project\/house\?view=public"/);assert.match(result[key],/Courtyard House/)}
assert.match(result.setup,/Your next step/);
assert.match(result.setup,/href="\/onboarding\/workspace\?import=saved"/);
assert.match(result.setup,/<details[^>]*><summary>Manage profile<\/summary>[\s\S]*Find &amp; manage coverage[\s\S]*Team notices<\/details>/);
assert.doesNotMatch(result.complete,/Your next step/);
assert.doesNotMatch(result.contributor,/Manage profile|Edit profile|Team notices/);
for (const key of ['ownerAbout','publicAbout']) {
  assert.match(result[key], /Saved studio biography/);
  assert.doesNotMatch(result[key], /No team members|Profile Completeness|Start Bio Interview/);
}
assert.match(result.ownerAbout, /Courtyard homes/);
assert.doesNotMatch(result.publicAbout, /Edit About section/);
assert.match(result.details,/<details/);assert.doesNotMatch(result.details,/<details[^>]* open/);assert.match(result.details,/Miami courtyard interiors/);assert.match(result.details,/Natural stone/);
assert.equal((result.structured.match(/<script/g)||[]).length,1);assert.match(result.structured,/Profile|identity/);console.log('PASS actual server render: both initial feeds, approved press/project anchors, closed useful profile details, and escaped linked identity markup');
})().catch(e=>{console.error(e);process.exitCode=1});
