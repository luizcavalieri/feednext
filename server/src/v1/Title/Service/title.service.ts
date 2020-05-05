// Nest dependencies
import { Injectable, HttpException, BadRequestException, HttpStatus } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'

// Other dependencies
import { Validator } from 'class-validator'
import { ObjectId } from 'mongodb'
import * as jwt from 'jsonwebtoken'

// Local files
import { TitlesRepository } from 'src/shared/Repositories/title.repository'
import { CreateTitleDto } from '../Dto/create-title.dto'
import { TitlesEntity } from 'src/shared/Entities/titles.entity'
import { CategoriesRepository } from 'src/shared/Repositories/categories.repository'
import { UpdateTitleDto } from '../Dto/update-title.dto'
import { serializerService, ISerializeResponse } from 'src/shared/Services/serializer.service'
import { EntriesRepository } from 'src/shared/Repositories/entries.repository'
import { UsersRepository } from 'src/shared/Repositories/users.repository'
import { CategoriesEntity } from 'src/shared/Entities/categories.entity'
import { AwsService } from 'src/shared/Services/aws.service'
import { configService } from 'src/shared/Services/config.service'

@Injectable()
export class TitleService {
    private validator: ObjectId

    constructor(
        @InjectRepository(TitlesRepository)
        private readonly titlesRepository: TitlesRepository,
        @InjectRepository(CategoriesRepository)
        private readonly categoriesRepository: CategoriesRepository,
        @InjectRepository(EntriesRepository)
        private readonly entriesRepository: EntriesRepository,
        @InjectRepository(UsersRepository)
        private readonly usersRepository: UsersRepository,
        private readonly awsService: AwsService,
    ) {
        this.validator = new Validator()
    }

    async getTitle(titleQueryData: string, isId: boolean): Promise<ISerializeResponse> {
        let title: TitlesEntity

        if (isId) {
            if (!this.validator.isMongoId(titleQueryData)) throw new BadRequestException('TitleId must be a MongoId.')
            title = await this.titlesRepository.getTitleById(titleQueryData)
        } else {
            title = await this.titlesRepository.getTitleBySlug(titleQueryData)
        }

        return serializerService.serializeResponse('title_detail', title)
    }

    async searchTitle({ searchValue } : { searchValue: string }): Promise<ISerializeResponse> {
        const result = await this.titlesRepository.searchTitle({ searchValue })
        return serializerService.serializeResponse('searched_title_list', result)
    }

    async getTitleList(
        query: {
            author: string,
            categoryIds: string[],
            sortBy: 'hot' | 'top',
            skip: number,
        }
    ): Promise<ISerializeResponse> {
        const result: {
            titles: TitlesEntity[],
            count: number
        } = await this.titlesRepository.getTitleList(query)
        return serializerService.serializeResponse('title_list', result)
    }

    async createTitle(openedBy: string, dto: CreateTitleDto): Promise<HttpException | ISerializeResponse> {
        let category: CategoriesEntity
        try {
          category = await this.categoriesRepository.findOneOrFail(dto.categoryId)
        } catch (err) {
          throw new BadRequestException(`Category with id:${dto.categoryId} does not match in database.`)
        }

        const newTitle: any = await this.titlesRepository.createTitle(openedBy, dto, category.ancestors)

        newTitle.image_upload_token = jwt.sign({
            titleSlug: newTitle.slug,
            name: newTitle.name,
            username: openedBy,
            exp: Math.floor(Date.now() / 1000) + 30, // Token expires 30 seconds
        }, configService.getEnv('SECRET_FOR_ACCESS_TOKEN'))

        return serializerService.serializeResponse('title_detail', newTitle)
    }

    async getTitlePicture(titleSlug: string): Promise<unknown> {
        await this.titlesRepository.getTitleBySlug(titleSlug)
        return this.awsService.getPictureBuffer(titleSlug, 'titles')
    }

    async uploadTitlePicture(titleSlug: string, file): Promise<void> {
        await this.titlesRepository.getTitleBySlug(titleSlug)
        this.awsService.uploadPicture(titleSlug, 'titles', file)
    }

    async rateTitle(ratedBy: string, titleId: string, rateValue: number): Promise<HttpException> {
        if (!this.validator.isMongoId(titleId)) throw new BadRequestException('TitleId must be a MongoId')

        try {
            this.usersRepository.findOneOrFail({ username: ratedBy })
        } catch (error) {
            throw new BadRequestException('User not found by given username')
        }

        await this.titlesRepository.rateTitle(ratedBy, titleId, rateValue)
        throw new HttpException('Title has been rated', HttpStatus.OK)
    }

    async getRateOfUser(username: string, titleId: string): Promise<any> {
        if (!this.validator.isMongoId(titleId)) throw new BadRequestException('TitleId must be a MongoId')

        try {
            this.usersRepository.findOneOrFail({ username })
        } catch (error) {
            throw new BadRequestException('User not found by given username')
        }

        const rate = await this.titlesRepository.getRateOfUser(username, titleId)
        return serializerService.serializeResponse('title_rate_of_user', { title_id: titleId, rate })
    }

    async getAvarageRate(titleId: string): Promise<ISerializeResponse> {
        if (!this.validator.isMongoId(titleId)) throw new BadRequestException('TitleId must be a MongoId.')
        const averageRate = await this.titlesRepository.getAvarageRate(titleId)
        return serializerService.serializeResponse('average_title_rate', { title_id: titleId, rate: averageRate })
    }

    async updateTitle(updatedBy: string, titleId: string, dto: UpdateTitleDto): Promise<ISerializeResponse> {
        if (!this.validator.isMongoId(titleId)) throw new BadRequestException('TitleId must be a MongoId.')

        let title: TitlesEntity
        try {
            title = await this.titlesRepository.findOneOrFail(titleId)
        } catch {
            throw new BadRequestException('Title could not found by given id')
        }

        if (dto.categoryId && !this.validator.isMongoId(dto.categoryId)) {
            throw new BadRequestException('CategoryId must be a MongoId.')
        }

        let category
        if (dto.categoryId) {
            try {
                category = await this.categoriesRepository.findOneOrFail(dto.categoryId)
            } catch (err) {
                throw new BadRequestException('Category could not found by given id')
            }
        }

        const oldSlug = title.slug
        const updatedTitle: TitlesEntity = await this.titlesRepository.updateTitle(updatedBy, title, dto, category?.ancestors)
        await this.awsService.renamePicture(updatedTitle.slug, 'titles', oldSlug)
            .catch(_error => {return})
        return serializerService.serializeResponse('title_detail', updatedTitle)
    }

    async deleteTitle(titleId: string): Promise<HttpException> {
        if (!this.validator.isMongoId(titleId)) throw new BadRequestException('TitleId must be a MongoId.')

        await this.titlesRepository.deleteTitle(titleId)
        await this.entriesRepository.deleteEntriesBelongsToTitle(titleId)
        throw new HttpException('Title has been deleted.', HttpStatus.OK)
    }
}
