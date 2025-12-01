import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bus } from './bus.entity';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { UpdateBusSeatMapDto } from './dto/update-bus-seat-map.dto';
import { SeatMap } from '../seat-maps/seat-map.entity';

@Injectable()
export class BusesService {
  constructor(
    @InjectRepository(Bus) private readonly busRepo: Repository<Bus>,
    @InjectRepository(SeatMap) private readonly seatMapRepo: Repository<SeatMap>,
  ) {}

  list() {
    return this.busRepo.find();
  }

  async findById(id: number) {
    const bus = await this.busRepo.findOne({ where: { id } });
    if (!bus) throw new NotFoundException('Bus not found');
    return bus;
  }

  private async resolveSeatMap(seatMapId?: number | null) {
    if (seatMapId === null || seatMapId === undefined) return null;
    const map = await this.seatMapRepo.findOne({ where: { id: seatMapId } });
    if (!map) throw new BadRequestException('Seat map not found');
    return map;
  }

  async create(dto: CreateBusDto) {
    const seatMap = await this.resolveSeatMap(dto.seatMapId);
    const bus = this.busRepo.create({
      name: dto.name,
      plateNumber: dto.plateNumber,
      seatMap: seatMap ?? null,
    });
    return this.busRepo.save(bus);
  }

  async update(id: number, dto: UpdateBusDto) {
    const bus = await this.busRepo.findOne({ where: { id } });
    if (!bus) throw new NotFoundException('Bus not found');
    if (dto.name) bus.name = dto.name;
    if (dto.plateNumber) bus.plateNumber = dto.plateNumber;
    return this.busRepo.save(bus);
  }

  async updateSeatMap(id: number, dto: UpdateBusSeatMapDto) {
    const bus = await this.busRepo.findOne({ where: { id } });
    if (!bus) throw new NotFoundException('Bus not found');
    const seatMap = await this.resolveSeatMap(dto.seatMapId);
    bus.seatMap = seatMap;
    await this.busRepo.save(bus);
    return bus;
  }
}
