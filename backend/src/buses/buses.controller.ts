import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { BusesService } from './buses.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { UpdateBusSeatMapDto } from './dto/update-bus-seat-map.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

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

  @Patch(':id/seat-map')
  updateSeatMap(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBusSeatMapDto,
  ) {
    return this.busesService.updateSeatMap(id, dto);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.delete(id);
  }

  @Post(':id/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: diskStorage({
        destination: './uploads/buses',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  uploadPhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.busesService.addPhoto(id, file.filename);
  }

  @Delete(':id/photos/:photoId')
  deletePhoto(
    @Param('id', ParseIntPipe) id: number,
    @Param('photoId') photoId: string,
  ) {
    return this.busesService.deletePhoto(id, photoId);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.deactivate(id);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.busesService.activate(id);
  }
}
