import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** App -> backend: pair the robot showing this code. */
export class PairDeviceDto {
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

/** Robot -> backend: log in with the credentials burned in at the factory. */
export class RobotAuthDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  serialNumber!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(200)
  secret!: string;
}

export const ROBOT_REPORTED_STATUS = ['online', 'charging', 'error'] as const;

/** Robot -> backend every minute or so. */
export class HeartbeatDto {
  @IsInt()
  @Min(0)
  @Max(100)
  batteryLevel!: number;

  @IsOptional()
  @IsIn(ROBOT_REPORTED_STATUS)
  status?: (typeof ROBOT_REPORTED_STATUS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  firmwareVersion?: string;
}

export class RobotDoseTakeDto {
  @IsIn(['robot_button', 'robot_sensor'])
  via!: 'robot_button' | 'robot_sensor';
}
