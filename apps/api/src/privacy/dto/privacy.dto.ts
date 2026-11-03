import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  /** Re-enter the password, so a stolen session token can't delete the account. */
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @Equals('DELETE', { message: 'confirm must be "DELETE"' })
  confirm!: string;
}
