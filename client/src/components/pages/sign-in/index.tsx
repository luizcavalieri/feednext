// Antd dependencies
import { Tabs } from 'antd'
import { Form } from '@ant-design/compatible'
import { FormComponentProps } from '@ant-design/compatible/es/form'

// Other dependencies
import React, { Component } from 'react'
import classNames from 'classnames'

// Local files
import LoginContext from './LoginContext'
import LoginItem, { LoginItemType } from './LoginItem'
import LoginSubmit from './LoginSubmit'
import LoginTab from './LoginTab'
import '@ant-design/compatible/assets/index.css'

export declare interface LoginProps {
	defaultActiveKey?: string
	onTabChange?: (key: string) => void
	style?: React.CSSProperties
	onSubmit?: (error: any, values: any) => void
	className?: string
	m: FormComponentProps['form']
	children: React.ReactElement<typeof LoginTab>[]
}

declare interface LoginState {
	tabs?: string[]
	type?: string
	active?: {
		[key: string]: any[]
	}
}

class Login extends Component<LoginProps, LoginState> {
	public static Tab = LoginTab

	public static Submit = LoginSubmit

	static defaultProps = {
		className: '',
		defaultActiveKey: '',
		onTabChange: (): void => {
			return
		},
		onSubmit: (): void => {
			return
		},
	}

	constructor(props: LoginProps) {
		super(props)
		this.state = {
			type: props.defaultActiveKey,
			tabs: [],
			active: {},
		}
	}

	onSwitch = (type: string): void => {
		this.setState(
			{
				type,
			},
			() => {
				const { onTabChange } = this.props
				if (onTabChange) {
					onTabChange(type)
				}
			},
		)
	}

	getContext = (): object => {
		const { form } = this.props
		const { tabs = [] } = this.state
		return {
			tabUtil: {
				addTab: (id: string): void => {
					this.setState({
						tabs: [...tabs, id],
					})
				},
				removeTab: (id: string): void => {
					this.setState({
						tabs: tabs.filter(currentId => currentId !== id),
					})
				},
			},
			form: {
				...form,
			},
			updateActive: (activeItem: string): void => {
				const { type = '', active = {} } = this.state
				if (active[type]) {
					active[type].push(activeItem)
				} else {
					active[type] = [activeItem]
				}
				this.setState({
					active,
				})
			},
		}
	}

	handleSubmit = (e: React.FormEvent): void => {
		e.preventDefault()
		const { active = {}, type = '' } = this.state
		const { form, onSubmit } = this.props
		const activeFields = active[type] || []
		if (form) {
			form.validateFields(
				activeFields,
				{
					force: true,
				},
				(err, values) => {
					if (onSubmit) {
						onSubmit(err, values)
					}
				},
			)
		}
	}

	render(): JSX.Element {
		const { className, children } = this.props
		const { type, tabs = [] } = this.state
		const TabChildren: any[] = []
		const otherChildren: any[] = []
		React.Children.forEach(children, (child: any) => {
			if (!child) {
				return
			}
			if (child.type.typeName === 'LoginTab') {
				TabChildren.push(child)
			} else {
				otherChildren.push(child)
			}
		})
		return (
			<LoginContext.Provider value={this.getContext()}>
				<div className={classNames(className, 'login')}>
					<Form onSubmit={this.handleSubmit}>
						{tabs.length ? (
							<React.Fragment>
								<Tabs animated={false} className={'tabs'} activeKey={type} onChange={this.onSwitch}>
									{TabChildren}
								</Tabs>
								{otherChildren}
							</React.Fragment>
						) : (
							children
						)}
					</Form>
				</div>
			</LoginContext.Provider>
		)
	}
}

;(Object.keys(LoginItem) as (keyof LoginItemType)[]).forEach(item => {
	Login[item] = LoginItem[item]
})

export default Form.create()(Login)
