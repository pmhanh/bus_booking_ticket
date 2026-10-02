import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Route } from './route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { RouteStop } from './route-stop.entity';
import { StopItemDto, UpdateStopsDto } from './dto/update-stops.dto';
import { FilterRoutesDto } from './dto/filter-routes.dto';
import { City } from '../cities/city.entity';
import { Booking } from '../../sales/bookings/entities/booking.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route) private readonly routesRepo: Repository<Route>,
    @InjectRepository(RouteStop)
    private readonly stopsRepo: Repository<RouteStop>,
    @InjectRepository(City) private readonly citiesRepo: Repository<City>,
  ) {}

  private async ensureCities(ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    const cities = await this.citiesRepo.find({ where: { id: In(uniqueIds) } });
    if (cities.length !== uniqueIds.length) {
      throw new BadRequestException('City not found');
    }
    return cities;
  }

  private validateStops(stops: StopItemDto[], routeDurationMinutes: number) {
    if (stops.length === 0) return;

    const sortedStops = [...stops].sort((a, b) => a.order - b.order);
    const seenOrders = new Set<number>();
    const seenCities = new Set<number>();
    let previousOffset = -1;

    sortedStops.forEach((stop, index) => {
      if (seenOrders.has(stop.order)) {
        throw new BadRequestException('Thứ tự điểm dừng không được trùng nhau');
      }
      seenOrders.add(stop.order);

      if (seenCities.has(stop.cityId)) {
        throw new BadRequestException(
          'Thành phố điểm dừng không được trùng nhau',
        );
      }
      seenCities.add(stop.cityId);

      if (stop.order !== index + 1) {
        throw new BadRequestException(
          'Thứ tự điểm dừng phải liên tục bắt đầu từ 1',
        );
      }

      if (stop.estimatedOffsetMinutes <= previousOffset) {
        throw new BadRequestException(
          'Điểm dừng phải có thời gian đến sau điểm dừng trước đó',
        );
      }
      previousOffset = stop.estimatedOffsetMinutes;

      if (stop.estimatedOffsetMinutes >= routeDurationMinutes) {
        throw new BadRequestException(
          'Điểm dừng phải có thời gian đến trước khi hết thời gian tuyến đường',
        );
      }
    });
  }

  private buildStops(
    repo: Repository<RouteStop>,
    route: Route,
    stops: StopItemDto[],
    cityMap: Map<number, City>,
  ) {
    return stops.map((stop) =>
      repo.create({
        route,
        city: cityMap.get(stop.cityId)!,
        type: stop.type,
        order: stop.order,
        estimatedOffsetMinutes: stop.estimatedOffsetMinutes,
      }),
    );
  }

  private stopChanged(existing: RouteStop, next: StopItemDto): boolean {
    return (
      existing.city.id !== next.cityId ||
      existing.type !== next.type ||
      existing.order !== next.order ||
      existing.estimatedOffsetMinutes !== next.estimatedOffsetMinutes
    );
  }

  private async assertStopsAreNotBooked(
    stopIds: number[],
    getBookingCount: (ids: number[]) => Promise<number>,
  ) {
    if (stopIds.length === 0) return;

    const bookingCount = await getBookingCount(stopIds);
    if (bookingCount > 0) {
      throw new ConflictException(
        'Không thể sửa hoặc xóa điểm dừng đã được dùng trong booking',
      );
    }
  }

  async create(dto: CreateRouteDto) {
    if (dto.originCityId === dto.destinationCityId) {
      throw new BadRequestException(
        'Thành phố xuất phát và thành phố đích phải khác nhau',
      );
    }

    const stopItems = dto.stops ?? [];
    this.validateStops(stopItems, dto.estimatedDurationMinutes);

    const cities = await this.ensureCities([
      dto.originCityId,
      dto.destinationCityId,
      ...stopItems.map((stop) => stop.cityId),
    ]);
    const cityMap = new Map<number, City>(
      cities.map((city) => [city.id, city]),
    );
    const origin = cityMap.get(dto.originCityId)!;
    const destination = cityMap.get(dto.destinationCityId)!;

    return this.routesRepo.manager.transaction(async (manager) => {
      const routeRepo = manager.getRepository(Route);
      const stopRepo = manager.getRepository(RouteStop);

      const route = routeRepo.create({
        name: dto.name,
        originCity: origin,
        destinationCity: destination,
        estimatedDurationMinutes: dto.estimatedDurationMinutes,
      });
      const savedRoute = await routeRepo.save(route);

      if (stopItems.length > 0) {
        const stops = this.buildStops(stopRepo, savedRoute, stopItems, cityMap);
        await stopRepo.save(stops);
      }

      const fullRoute = await routeRepo.findOne({
        where: { id: savedRoute.id },
        relations: ['stops'],
        order: { stops: { order: 'ASC' } },
      });

      if (!fullRoute) {
        throw new NotFoundException('Tuyến đường không tìm thấy');
      }

      return fullRoute;
    });
  }

  async findAll(query: FilterRoutesDto = {}) {
    const qb = this.routesRepo
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.originCity', 'origin')
      .leftJoinAndSelect('route.destinationCity', 'destination');
    if (query.originCityId) {
      qb.andWhere('origin.id = :oid', { oid: query.originCityId });
    }
    if (query.destinationCityId) {
      qb.andWhere('destination.id = :did', { did: query.destinationCityId });
    }

    qb.orderBy('route.id', 'DESC');

    if (query.limit != null) qb.take(query.limit);
    if (query.offset != null) qb.skip(query.offset);

    const [routes, total] = await qb.getManyAndCount();

    return {
      routes,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async findById(id: number) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['stops'],
      order: { stops: { order: 'ASC' } },
    });
    if (!route) throw new NotFoundException('Tuyến đường không tìm thấy');
    return route;
  }

  async update(id: number, dto: UpdateRouteDto) {
    const route = await this.routesRepo.findOne({
      where: { id },
      relations: ['stops', 'stops.city'],
      order: { stops: { order: 'ASC' } },
    });
    if (!route) throw new NotFoundException('Tuyến đường không tìm thấy');

    const currentOriginId = route.originCity.id;
    const currentDestinationId = route.destinationCity.id;
    const nextOriginId = dto.originCityId ?? currentOriginId;
    const nextDestinationId = dto.destinationCityId ?? currentDestinationId;

    if (nextOriginId === nextDestinationId) {
      throw new BadRequestException(
        'Thành phố xuất phát và thành phố đích phải khác nhau',
      );
    }

    if (dto.originCityId || dto.destinationCityId) {
      const ids = [dto.originCityId, dto.destinationCityId].filter(
        Boolean,
      ) as number[];
      const cities = await this.ensureCities(ids);
      const map = new Map<number, City>(cities.map((city) => [city.id, city]));
      if (dto.originCityId) route.originCity = map.get(dto.originCityId)!;
      if (dto.destinationCityId)
        route.destinationCity = map.get(dto.destinationCityId)!;
    }

    if (dto.name) route.name = dto.name;
    if (dto.estimatedDurationMinutes)
      route.estimatedDurationMinutes = dto.estimatedDurationMinutes;

    if (route.stops?.length) {
      this.validateStops(
        route.stops.map((stop) => ({
          cityId: stop.city.id,
          type: stop.type,
          order: stop.order,
          estimatedOffsetMinutes: stop.estimatedOffsetMinutes,
        })),
        route.estimatedDurationMinutes,
      );
    }

    return this.routesRepo.save(route);
  }

  async delete(id: number) {
    const res = await this.routesRepo.delete(id);
    if (!res.affected)
      throw new NotFoundException('Tuyến đường không tìm thấy');
    return { ok: true };
  }

  async updateStops(routeId: number, dto: UpdateStopsDto) {
    return this.routesRepo.manager.transaction(async (manager) => {
      const stopRepo = manager.getRepository(RouteStop);
      const routeRepo = manager.getRepository(Route);
      const route = await routeRepo.findOne({ where: { id: routeId } });
      if (!route) throw new NotFoundException('Tuyến đường không tìm thấy');

      this.validateStops(dto.stops, route.estimatedDurationMinutes);

      const existingStops = await stopRepo.find({
        where: { route: { id: routeId } },
        relations: ['city'],
        order: { order: 'ASC' },
      });
      const existingById = new Map(
        existingStops.map((stop) => [stop.id, stop]),
      );
      const submittedIds = dto.stops
        .map((stop) => stop.id)
        .filter((id): id is number => id !== undefined);

      if (new Set(submittedIds).size !== submittedIds.length) {
        throw new BadRequestException('ID điểm dừng phải là duy nhất');
      }

      for (const id of submittedIds) {
        if (!existingById.has(id)) {
          throw new BadRequestException(
            'Điểm dừng không thuộc tuyến đường này',
          );
        }
      }

      const submittedById = new Map(
        dto.stops
          .filter(
            (stop): stop is StopItemDto & { id: number } =>
              stop.id !== undefined,
          )
          .map((stop) => [stop.id, stop]),
      );
      const changedOrRemovedIds = existingStops
        .filter((existing) => {
          const submitted = submittedById.get(existing.id);
          return !submitted || this.stopChanged(existing, submitted);
        })
        .map((stop) => stop.id);

      await this.assertStopsAreNotBooked(changedOrRemovedIds, async (ids) =>
        manager
          .getRepository(Booking)
          .createQueryBuilder('booking')
          .where('booking.pickup_stop_id IN (:...ids)', { ids })
          .orWhere('booking.dropoff_stop_id IN (:...ids)', { ids })
          .getCount(),
      );

      const removedIds = existingStops
        .filter((stop) => !submittedById.has(stop.id))
        .map((stop) => stop.id);
      if (removedIds.length > 0) {
        await stopRepo.delete(removedIds);
      }

      // Free all existing order values first so swaps/reordering do not violate
      // the unique (route_id, order) constraint during individual updates.
      if (existingStops.length > 0) {
        await stopRepo
          .createQueryBuilder()
          .update(RouteStop)
          .set({ order: () => '"order" + 1000000' })
          .where('route_id = :routeId', { routeId })
          .execute();
      }

      const cities = await this.ensureCities(
        dto.stops.map((stop) => stop.cityId),
      );
      const cityMap = new Map(cities.map((city) => [city.id, city]));
      const stopsToSave = dto.stops.map((stop) => {
        if (stop.id !== undefined) {
          const existing = existingById.get(stop.id)!;
          existing.city = cityMap.get(stop.cityId)!;
          existing.type = stop.type;
          existing.order = stop.order;
          existing.estimatedOffsetMinutes = stop.estimatedOffsetMinutes;
          return existing;
        }

        return stopRepo.create({
          route,
          city: cityMap.get(stop.cityId)!,
          type: stop.type,
          order: stop.order,
          estimatedOffsetMinutes: stop.estimatedOffsetMinutes,
        });
      });

      await stopRepo.save(stopsToSave);

      return stopRepo.find({
        where: { route: { id: routeId } },
        order: { order: 'ASC' },
      });
    });
  }

  getStops(routeId: number) {
    return this.stopsRepo.find({
      where: { route: { id: routeId } },
      order: { order: 'ASC' },
    });
  }
}
