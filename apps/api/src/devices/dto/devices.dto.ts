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

  /** Serial the robot reported over Bluetooth; the code must belong to it. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  serialNumber?: string;
}

/** What the app can ask the robot to do from the "pebble" tab. */
/**
 * wake: say hello + listen · forward/backward/left/right: move until "stop" (sent on release)
 * wave: wave the arm · box: open/close the pill box
 */
export const ROBOT_ACTIONS = ['wake', 'forward', 'backward', 'left', 'right', 'stop', 'wave', 'box'] as const;
export type RobotAction = (typeof ROBOT_ACTIONS)[number];

/** App -> backend -> robot: a remote-control command. */
export class RobotCommandDto {
  @IsIn(ROBOT_ACTIONS)
  action!: RobotAction;
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
