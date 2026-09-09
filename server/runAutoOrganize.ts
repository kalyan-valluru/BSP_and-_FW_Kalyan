import { UniversalVendorOrganizer } from './universalVendorOrganizer';

async function main() {
  const args = process.argv.slice(2);
  const vendor = args[0] || 'renesas';
  const family = args[1] || 'rz_g2l';

  const organizer = new UniversalVendorOrganizer();
  await organizer.scanAndOrganize(vendor, family);
}

main().catch(console.error);
