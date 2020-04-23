// Nest dependencies
import { UnprocessableEntityException, BadRequestException } from '@nestjs/common'

// Other dependencies
import { Repository, EntityRepository } from 'typeorm'
import slugify from 'slugify'

// Local files
import { TitlesEntity } from '../Entities/titles.entity'
import { CreateTitleDto } from 'src/v1/Title/Dto/create-title.dto'
import { UpdateTitleDto } from 'src/v1/Title/Dto/update-title.dto'

@EntityRepository(TitlesEntity)
export class TitlesRepository extends Repository<TitlesEntity> {
    async getTitle(titleSlug: string): Promise<TitlesEntity> {
        try {
            const title: TitlesEntity = await this.findOneOrFail({slug: titleSlug})
            return title
        } catch (err) {
            throw new BadRequestException('No title found for given slug')
        }
    }

    async searchTitle({ searchValue } : { searchValue: string }): Promise<{ titles: TitlesEntity[] }> {
        const [titles] = await this.findAndCount({
            where: {
                name: new RegExp(searchValue, 'i')
            },
            take: 5,
            order: {
                entry_count: 'DESC'
            }
        })

        return { titles }
    }

    async updateEntryCount(titleSlug: string, isIncrement: boolean): Promise<void> {
        try {
            const title: TitlesEntity = await this.findOneOrFail({ slug: titleSlug })
            isIncrement ? title.entry_count++ : title.entry_count--
            this.save(title)
        } catch (err) {
            throw new BadRequestException('Title with that id could not found in the database')
        }
    }

    async getTitleList(query: { limit: number, skip: number, orderBy: any }): Promise<{ titles: TitlesEntity[], count: number }> {
        const orderBy = query.orderBy || 'ASC'
        const [titles, total] = await this.findAndCount({
            order: {
                name: orderBy.toUpperCase(),
            },
            take: Number(query.limit) || 10,
            skip: Number(query.skip) || 0,
        })

        return { titles, count: total }
    }

    async getTitleListByCategory({ categoryId, query }: {
        categoryId: string
        query: { limit: number, skip: number, orderBy: any }
    }): Promise<{ titles: TitlesEntity[], count: number }> {
        const orderBy = query.orderBy || 'ASC'

        const [titles, total] = await this.findAndCount({
            where: {
                category_id: categoryId
            },
            order: {
                name: orderBy.toUpperCase(),
            },
            take: Number(query.limit) || 10,
            skip: Number(query.skip) || 0,
        })

        return { titles, count: total }
    }

    async getTitleListByAuthorOfIt({ username, query }: {
        username: string
        query: { limit: number, skip: number, orderBy: any }
    }): Promise<{ titles: TitlesEntity[], count: number }> {
        const orderBy = query.orderBy || 'ASC'

        const [titles, total] = await this.findAndCount({
            where: {
                opened_by: username
            },
            order: {
                name: orderBy.toUpperCase(),
            },
            take: Number(query.limit) || 10,
            skip: Number(query.skip) || 0,
        })

        return { titles, count: total }
    }

    async createTitle(openedBy: string, dto: CreateTitleDto): Promise<TitlesEntity> {
        const newTitle: TitlesEntity = new TitlesEntity({
            name: dto.name,
            slug: slugify(dto.name, { lower: true }),
            category_id: dto.categoryId,
            opened_by: openedBy,
        })

        try {
            return await this.save(newTitle)
        } catch (err) {
            throw new UnprocessableEntityException(err.errmsg)
        }
    }

    async rateTitle(ratedBy: string, titleId: string, rateValue: number): Promise<void> {
        let title
        try {
            title = await this.findOneOrFail(titleId)
        } catch (error) {
            throw new BadRequestException('Title not found by given title id')
        }

        const docIfAlreadyRated = title.rate.find(item => item.username === ratedBy)
        if (docIfAlreadyRated) docIfAlreadyRated.rateValue = rateValue
        else title.rate.push({ username: ratedBy, rateValue})

        this.save(title)
    }

    async getRateOfUser(username: string, titleId: string): Promise<any> {
        let title: TitlesEntity
        try {
            title = await this.findOneOrFail(titleId)
        } catch (error) {
            throw new BadRequestException('Title not found by given title id')
        }

        const userRate: { rateValue: number } | undefined = title.rate.find((
            item: {username: string, rateValue: number }
        ) => item.username === username)

        if (userRate) return userRate!.rateValue
        throw new BadRequestException('This user did not rate this title yet')
    }

    async getAvarageRate(titleId: string): Promise<number> {
        let title: TitlesEntity
        try {
            title = await this.findOneOrFail(titleId)
        } catch (error) {
            throw new BadRequestException('Title not found by given title id')
        }

        const averageRate = title.rate.reduce((
            total,
            next: { username: string, rateValue: number }
        ) => total + next.rateValue, 0) / title.rate.length

        return Math.round(averageRate)
    }

    async updateTitle(updatedBy: string, titleId: string, dto: UpdateTitleDto): Promise<TitlesEntity> {
        if (dto.categoryId) {
            try {
                await this.findOneOrFail(dto.categoryId)
            } catch (err) {
                throw new BadRequestException('Title could not found that belongs to given category id.')
            }
        }

        let title: TitlesEntity
        try {
            title = await this.findOneOrFail(titleId)
        } catch {
            throw new BadRequestException('Title related to that id could not found in the database.')
        }

        try {
            if (dto.name) {
                title.name = dto.name
                title.slug = slugify(dto.name, { lower: true })
            }
            if (dto.categoryId) title.category_id = dto.categoryId
            title.updated_by = updatedBy

            await this.save(title)
            return title
        } catch (err) {
            throw new BadRequestException(err.errmsg)
        }
    }

    async deleteTitle(titleId: string): Promise<TitlesEntity> {
        try {
            const title: TitlesEntity = await this.findOneOrFail(titleId)
            await this.delete(title)
            return title
        } catch (err) {
            throw new BadRequestException('Title with that id could not found in the database.')
        }
    }
}
