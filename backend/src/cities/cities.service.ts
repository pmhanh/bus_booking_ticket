import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { City } from './city.entity';

type ProvinceApiItem = {
  code: number;
  name: string;
  codename: string;
  division_type?: string;
  phone_code?: string;
};

@Injectable()
export class CitiesService implements OnModuleInit {
  private readonly logger = new Logger(CitiesService.name);

  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private async fetchProvinces() {
    const v1Url = 'https://provinces.open-api.vn/api/?depth=1';
    const resV1 = await firstValueFrom(
      this.http.get<ProvinceApiItem[]>(v1Url, { timeout: 8000 }),
    );
    return resV1.data ?? [];
  }

  async onModuleInit() {
    const auto = this.config.get<string>('CITY_AUTO_SYNC') ?? 'true';
    if (auto === 'false') return;
    const count = await this.cityRepo.count();
    if (count > 0) return;
    try {
      await this.syncFromProvincesApiV2();
      this.logger.log('Auto-synced provinces on startup');
    } catch (err) {
      this.logger.warn(`Auto-sync provinces failed: ${(err as Error).message}`);
    }
  }

  async syncFromProvincesApiV2() {
    const items = await this.fetchProvinces();
    const mapped = items.map((item) =>
      this.cityRepo.create({
        code: item.code,
        name: item.name,
        slug: item.codename,
        divisionType: item.division_type,
        phoneCode: item.phone_code,
      }),
    );
    await this.cityRepo.upsert(mapped, ['code']);
    this.logger.log(`Synced ${mapped.length} provinces into cities table.`);
    return { ok: true, count: mapped.length };
  }

  private async ensureSeeded() {
    const count = await this.cityRepo.count();
    if (count === 0) {
      await this.syncFromProvincesApiV2();
    }
  }

  async findAll() {
    await this.ensureSeeded();
    return this.cityRepo.find({
      select: ['id', 'name', 'slug', 'code'],
      order: { name: 'ASC' },
    });
  }

  async search(query: string, limit = 10) {
    await this.ensureSeeded();
    if (!query) return this.findAll();
    return this.cityRepo.find({
      where: { name: ILike(`%${query}%`) },
      take: limit,
      order: { name: 'ASC' },
    });
  }
}
