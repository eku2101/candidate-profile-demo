import {build} from 'esbuild';
import {copyFile,mkdir} from 'node:fs/promises';
await mkdir('vendor',{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd()},bundle:true,minify:true,format:'esm',platform:'browser',target:['es2022'],outfile:'vendor/supabase.js',legalComments:'eof'});
await copyFile('node_modules/@supabase/supabase-js/LICENSE','vendor/SUPABASE-LICENSE');
