import { Modal, type ModalProps } from '@mantine/core'

import classes from './AppModal.module.css'

const appModalClassNames = {
	content: classes.content,
	header: classes.header,
	title: classes.title,
	body: classes.body,
	close: classes.close,
}

export function AppModal({ classNames, ...props }: ModalProps) {
	return <Modal {...props} classNames={{ ...appModalClassNames, ...classNames }} />
}
