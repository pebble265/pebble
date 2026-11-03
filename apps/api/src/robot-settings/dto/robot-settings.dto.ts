import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HHMM } from '../../common/validation';

export class UpdateRobotSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  robotName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  voiceId?: string;

  /** 0.5 = slow, 1.0 = normal, 2.0 = fast */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(2)
  speechRate?: number;

  /** What the robot says on greeting. "{name}" is replaced with the user's name. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  greetingText?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  wakeWord?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  faceTheme?: string;

  /** "22:00" — robot won't start conversations from here. null turns quiet hours off. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(HHMM, { message: 'quietHoursStart must be HH:MM' })
  quietHoursStart?: string | null;

  /** "07:00" — end of quiet hours. Set together with quietHoursStart. */
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Matches(HHMM, { message: 'quietHoursEnd must be HH:MM' })
  quietHoursEnd?: string | null;
}
