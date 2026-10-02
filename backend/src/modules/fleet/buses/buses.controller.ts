import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { imageUploadOptions } from '../../../infrastructure/cloudinary/image-upload.options';
import { BusesService } from './buses.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { UpdateBusStatusDto } from './dto/update-bus-status.dto';
import { JwtAuthGuard } from '../../../core/guards/jwt-auth.guard';
import { RolesGuard } from '../../../core/guards/roles.guard';
import { Roles } from '../../../core/decorators/roles.decorator';

@Roles('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/buses')
export class BusesController {
  constructor(private readonly busesService: BusesService) {}

  @Get()
  list() {
    return this.busesService.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateBusDto) {
    return this.busesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBusDto) {
    return this.busesService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.delete(id);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('photo', imageUploadOptions(5 * 1024 * 1024)),
  )
  uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.busesService.addPhoto(id, file);
  }

  @Delete(':id/photos')
  deletePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Query('url') photoUrl: string,
  ) {
    return this.busesService.deletePhoto(id, photoUrl);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBusStatusDto,
  ) {
    return this.busesService.updateStatus(id, dto.isActive);
  }
}
