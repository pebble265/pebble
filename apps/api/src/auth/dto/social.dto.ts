import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** POST /auth/apple — from expo-apple-authentication's signInAsync(). */
export class AppleSignInDto {
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  identityToken!: string;

  /**
   * Apple puts the name only in the app's response, and only the very first
   * time the user signs in (it is never inside the token).
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceInfo?: string;
}

/** POST /auth/google — the id_token from the Google sign-in sheet. */
export class GoogleSignInDto {
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  idToken!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceInfo?: string;
}
