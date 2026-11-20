import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyResetCodeDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Matches(/^\d{5}$/, { message: 'Code must be 5 digits' })
  code!: string;
}

export class ResetPasswordDto {
  @IsString()
  @MaxLength(128)
  resetToken!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceInfo?: string;
}
