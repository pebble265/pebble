import { Controller, Get } from '@nestjs/common';
import { TERMS, TERMS_VERSION } from './terms';

@Controller('legal')
export class LegalController {
  /** GET /legal/terms — public, shown before the account is used */
  @Get('terms')
  terms() {
    return { version: TERMS_VERSION, ...TERMS };
  }
}
