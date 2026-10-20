import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from 'src/common/typeorm/entities/api-usage.entity';
import { ApiUsageDaily } from 'src/common/typeorm/entities/api-usage-daily.entity';
import { ApiUsageService } from './api-usage.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiUsage, ApiUsageDaily])],
  providers: [ApiUsageService],
  exports: [ApiUsageService],
})
export class ApiUsageModule {}
