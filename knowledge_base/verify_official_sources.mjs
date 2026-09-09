import fs from 'node:fs';
import { URL } from 'node:url';
const manifest = JSON.parse(fs.readFileSync(new URL('../backend/data/official_hardware_sources.json', import.meta.url)));
const allowed = {
  'STMicroelectronics': ['st.com'],
  'NXP': ['nxp.com'],
  'AMD': ['amd.com','xilinx.com'],
  'TI': ['ti.com'],
  'NVIDIA': ['nvidia.com'],
  'Raspberry Pi': ['raspberrypi.com']
};
let ok=true;
for(const d of manifest.documents){
  const host=new URL(d.url).hostname.toLowerCase();
  const valid=(allowed[d.vendor]||[]).some(domain=>host===domain||host.endsWith(`.${domain}`));
  console.log(`${valid?'OK':'REJECT'} ${d.vendor}: ${d.title} -> ${d.url}`);
  if(!valid) ok=false;
}
process.exit(ok?0:1);
