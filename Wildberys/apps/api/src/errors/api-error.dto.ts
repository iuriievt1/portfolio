import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDetail {
  @ApiProperty({ description: 'The request field the problem is about.', example: 'email' })
  readonly field!: string;

  @ApiProperty({ example: 'email must be an email' })
  readonly message!: string;
}

/** The body of every error response. */
export class ApiError {
  @ApiProperty({ type: 'integer', example: 400 })
  readonly statusCode!: number;

  @ApiProperty({
    description: 'A stable code for programs. The apps choose the text for the user by it.',
    example: 'VALIDATION_FAILED',
  })
  readonly code!: string;

  @ApiProperty({ description: 'A text for developers, in English.' })
  readonly message!: string;

  @ApiProperty({ description: 'The id of the request, the same as in the x-request-id header.' })
  readonly requestId!: string;

  @ApiPropertyOptional({ type: [ApiErrorDetail] })
  readonly details?: ApiErrorDetail[];
}
