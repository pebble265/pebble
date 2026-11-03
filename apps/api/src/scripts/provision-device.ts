/**
 * Registers a new robot in the database ("factory provisioning").
 *
 * Usage (from apps/api):
 *   npm run build
 *   node --env-file=.env dist/scripts/provision-device.js [pillSlots]
 *
 * Prints the serial number and secret ONCE. Put them in the robot's config.
 * Only a hash of the secret is stored, so it cannot be shown again.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { randomBytes } from 'crypto';
import { sha256 } from '../devices/devices.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule] })
class ProvisionModule {}

async function main() {
  const pillSlots = Number(process.argv[2] ?? 0);
  if (!Number.isInteger(pillSlots) || pillSlots < 0 || pillSlots > 32) {
    throw new Error('pillSlots must be a whole number between 0 and 32');
  }

  const app = await NestFactory.createApplicationContext(ProvisionModule, {
    logger: ['error'],
  });
  const prisma = app.get(PrismaService);

  const serialNumber = `PBL-${randomBytes(4).toString('hex').toUpperCase()}`;
  const secret = randomBytes(32).toString('base64url');

  await prisma.devices.create({
    data: {
      serial_number: serialNumber,
      device_secret_hash: sha256(secret),
      pill_slots_total: pillSlots,
    },
  });
  await app.close();

  console.log('Robot provisioned. Save these now — the secret is not stored:');
  console.log(`  PEBBLE_SERIAL=${serialNumber}`);
  console.log(`  PEBBLE_SECRET=${secret}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
