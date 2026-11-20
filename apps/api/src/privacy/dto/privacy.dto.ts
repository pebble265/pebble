import { Equals, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  /** Re-enter the password, so a stolen session token can't delete the account. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password?: string;

  /** Accounts made with Apple / Google confirm by signing in with it again instead. */
  @IsOptional()
  @IsIn(['apple', 'google'])
  provider?: 'apple' | 'google';

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  idToken?: string;

  @Equals('DELETE', { message: 'confirm must be "DELETE"' })
  confirm!: string;
}
