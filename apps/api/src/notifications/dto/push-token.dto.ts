import { IsIn, Matches, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  /** From expo-notifications getExpoPushTokenAsync(): "ExponentPushToken[xxxx]" */
  @MaxLength(200)
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, {
    message: 'token must be an Expo push token',
  })
  token!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}

export class RemovePushTokenDto {
  @MaxLength(200)
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, {
    message: 'token must be an Expo push token',
  })
  token!: string;
}
