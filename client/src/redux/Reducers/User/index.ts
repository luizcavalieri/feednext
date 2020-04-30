/* eslint-disable @typescript-eslint/camelcase */
import { SIGN_IN, SIGN_OUT, UserActions, UPDATE_USER } from '../../Actions/User/types'

const userReducerDefaultState: any = null

export const userReducer = (state = userReducerDefaultState, action: UserActions): any => {
	switch (action.type) {
		case SIGN_IN:
			return (state = action.user)
		case SIGN_OUT:
			return (state = null)
		case UPDATE_USER:
			return {
				...state,
				attributes: {
					...state.attributes,
					user: {
						...state.attributes.user,
						// eslint-disable-next-line @typescript-eslint/camelcase
						...action.payload.fullName && { full_name: action.payload.fullName },
						...action.payload.link && { link: action.payload.link },
						...action.payload.biography && { biography: action.payload.biography },
					}
				}
			}
		default:
			return state
	}
}
