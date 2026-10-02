import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { firstValueFrom } from 'rxjs';
import { ILike, Repository } from 'typeorm';
import { City } from './city.entity';
import { FilterCityDto } from './dto/filter-city.dto'; // Import DTO vừa tạo

type ProvinceApiItem = {
   
  code: number;
  name: string;
  codename: string;
  division_type?: string;
  phone_code?: string;
};

@Injectable()
export class CitiesService {
  private readonly logger = new Logger(CitiesService.name);

  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    private readonly http: HttpService,
  ) {}

  private async fetchProvinces() {
    const v1Url = 'https://provinces.open-api.vn/api/?depth=1';
    const resV1 = await firstValueFrom(
      this.http.get<ProvinceApiItem[]>(v1Url, { timeout: 8000 }),
    );
    return resV1.data ?? [];
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

  async findAll(filter: FilterCityDto) {
    const limit = filter.limit || 10;
    const page = filter.page || 1;
    const skip = (page - 1) * limit;
    const q = filter.q?.trim();
    const whereCondition = q ? { name: ILike(`%${q}%`) } : {};

    const [data, total] = await this.cityRepo.findAndCount({
      select: ['id', 'name', 'slug', 'code'],
      where: whereCondition,
      take: limit,
      skip: skip,
      order: { name: 'ASC' },
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

