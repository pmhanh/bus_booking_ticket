import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Route } from './route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteStop } from './route-stop.entity';
import { UpdateStopsDto } from './dto/update-stops.dto';
import { City } from '../cities/city.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    @InjectRepository(RouteStop)
    private readonly stopsRepo: Repository<RouteStop>,
    @InjectRepository(City) private readonly citiesRepo: Repository<City>,
  ) {}

  private async ensureCities(ids: number[]) {
    const cities = await this.citiesRepo.find({ where: { id: In(ids) } });
    if (cities.length !== ids.length)
      throw new BadRequestException('City not found');
    return cities;
  }

  async create(dto: CreateRouteDto) {
    if (dto.originCityId === dto.destinationCityId)
      throw new BadRequestException(
        'Điểm đi và điểm đến không được trùng nhau',
      );
    const [origin, destination] = await this.ensureCities([
      dto.originCityId,
      dto.destinationCityId,
    ]);
    const route = this.routesRepo.create({
      name: dto.name,
      originCity: origin,
      destinationCity: destination,
      estimatedDurationMinutes: dto.estimatedDurationMinutes,
    });
    return this.routesRepo.save(route);
  }

  async findAll(
    filter?: { originCityId?: number; destinationCityId?: number },
    pagination?: { limit?: number; offset?: number },
  ) {
    const qb = this.routesRepo
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.originCity', 'origin')
      .leftJoinAndSelect('route.destinationCity', 'destination');
    if (filter?.originCityId)
      qb.andWhere('origin.id = :oid', { oid: filter.originCityId });
    if (filter?.destinationCityId)
      qb.andWhere('destination.id = :did', { did: filter.destinationCityId });

    qb.orderBy('route.id', 'DESC');

    if (pagination?.limit) qb.take(pagination.limit);
    if (pagination?.offset) qb.skip(pagination.offset);

    const [routes, total] = await qb.getManyAndCount();

    return {
      routes,
      total,
      limit: pagination?.limit,
      offset: pagination?.offset,
    };
  }

  async findById(id: number) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['stops'],
      order: { stops: { order: 'ASC' } },
    });
    if (!route) throw new NotFoundException('Route not found');
    return route;
  }

  async update(id: number, dto: UpdateRouteDto) {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Route not found');
    // if (
    //   dto.originCityId &&
    //   dto.destinationCityId &&
    //   dto.originCityId === dto.destinationCityId
    // )
    //   throw new BadRequestException(
    //     'Điểm đi và điểm đến không được trùng nhau',
    //   );
    const currentOriginId = route.originCity.id;
    const currentDestinationId = route.destinationCity.id;

    const nextOriginId = dto.originCityId ?? currentOriginId;
    const nextDestinationId = dto.destinationCityId ?? currentDestinationId;

    if (nextOriginId === nextDestinationId) {
      throw new BadRequestException('Điểm đi và điểm đến không được trùng nhau');
    }
    if (dto.originCityId || dto.destinationCityId) {
      const ids = [dto.originCityId, dto.destinationCityId].filter(
        Boolean,
      ) as number[];
      const cities = await this.ensureCities(ids);
      const map = new Map<number, City>(cities.map((c) => [c.id, c]));
      if (dto.originCityId) route.originCity = map.get(dto.originCityId)!;
      if (dto.destinationCityId)
        route.destinationCity = map.get(dto.destinationCityId)!;
    }
    if (dto.name) route.name = dto.name;
    if (dto.estimatedDurationMinutes)
      route.estimatedDurationMinutes = dto.estimatedDurationMinutes;
    return this.routesRepo.save(route);
  }

  async delete(id: number) {
    const res = await this.routesRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Route not found');
    return { ok: true };
  }

  async updateStops(routeId: number, dto: UpdateStopsDto) {
    const route = await this.routesRepo.findOne({ where: { id: routeId } });
    if (!route) throw new NotFoundException('Route not found');
    const cityIds = dto.stops.map((s) => s.cityId);
    const cities = await this.ensureCities(cityIds);
    const cityMap = new Map<number, City>(cities.map((c) => [c.id, c]));
    await this.stopsRepo.delete({ route: { id: routeId } });
    const stops = dto.stops.map((s) =>
      this.stopsRepo.create({
        route,
        city: cityMap.get(s.cityId),
        type: s.type,
        order: s.order,
        estimatedOffsetMinutes: s.estimatedOffsetMinutes,
      }),
    );
    await this.stopsRepo.save(stops);
    return this.stopsRepo.find({
      where: { route: { id: routeId } },
      order: { order: 'ASC' },
    });
  }

  getStops(routeId: number) {
    return this.stopsRepo.find({
      where: { route: { id: routeId } },
      order: { order: 'ASC' },
    });
  }

  async deactivate(id: number) {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Route not found');
    route.isActive = false;
    await this.routesRepo.save(route);
    return route;
  }

  async activate(id: number) {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Route not found');
    route.isActive = true;
    await this.routesRepo.save(route);
    return route;
  }
}