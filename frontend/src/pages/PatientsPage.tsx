import { useEffect, useMemo, useState } from 'react'
import { Box, Button, Group, Loader, Table, Text } from '@mantine/core'

import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import { SideBar } from '../components/custom/sidebar/SideBar'
import { PageInfo } from '../components/custom/pageInfo/PageInfo'
import { PageContentContainer } from '../components/custom/pageContentContainer/PageContentContainer'

import SplitText from '../components/react-bits/SplitText'
import { useAuth } from '../auth/AuthContext'
import { APP_SIDEBAR_ITEMS } from '../lib/sidebarItems'

type PatientListItemResponse = {
	id: number
	name: string
	birthDate: string
	gender: string
	bmi: number
	goal: string
	activityLevel: string
	createdAt: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? ''
const LOAD_PATIENTS_ERROR_MESSAGE = 'Nao foi possivel carregar os pacientes.'

function buildApiUrl(path: string) {
	if (!API_BASE_URL) {
		return path
	}

	return `${API_BASE_URL}${path}`
}

function formatDate(dateValue: string) {
	const parsedDate = new Date(dateValue)
	if (Number.isNaN(parsedDate.getTime())) {
		return '-'
	}

	return parsedDate.toLocaleDateString('pt-BR')
}

function formatGender(gender: string) {
	if (gender === 'female') {
		return 'Feminino'
	}

	if (gender === 'male') {
		return 'Masculino'
	}

	return 'Outro'
}

function formatActivityLevel(activityLevel: string) {
	const labels: Record<string, string> = {
		sedentary: 'Sedentario',
		light: 'Leve',
		moderate: 'Moderado',
		intense: 'Intenso',
		'very-intense': 'Muito intenso',
	}

	return labels[activityLevel] ?? activityLevel
}

export function PatientsPage() {
	const { token, logout } = useAuth()
	const [patients, setPatients] = useState<PatientListItemResponse[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	const buttonClassNames = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}

	const hasPatients = useMemo(() => patients.length > 0, [patients.length])

	const loadPatients = async (signal?: AbortSignal) => {
		if (!token) {
			setPatients([])
			setIsLoading(false)
			return
		}

		try {
			setIsLoading(true)
			setErrorMessage(null)

			const response = await fetch(buildApiUrl('/api/patients'), {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: 'application/json',
				},
				signal,
			})

			if (response.status === 401) {
				logout()
				return
			}

			if (!response.ok) {
				throw new Error(LOAD_PATIENTS_ERROR_MESSAGE)
			}

			const data = (await response.json()) as PatientListItemResponse[]
			if (!signal?.aborted) {
				setPatients(data)
			}
		} catch (error) {
			if (signal?.aborted) {
				return
			}

			const message = error instanceof Error ? error.message : LOAD_PATIENTS_ERROR_MESSAGE
			setErrorMessage(message)
		} finally {
			if (!signal?.aborted) {
				setIsLoading(false)
			}
		}
	}

	useEffect(() => {
		const controller = new AbortController()
		void loadPatients(controller.signal)

		return () => {
			controller.abort()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token, logout])

	return (
		<Box className="flex h-screen flex-row max-[768px]:h-dvh max-[768px]:flex-col">
			<SideBar
				title="NutriSaaS"
				items={APP_SIDEBAR_ITEMS}
				footer={null}
				color="--color4"
				defaultCollapsed={true}
			/>

			<Box className="flex min-w-0 flex-1 flex-col overflow-hidden p-0 max-[768px]:w-full">
				<Box className="px-3 md:px-6">
					<PageInfo
						title={(
							<SplitText
								text="Pacientes"
								className="text-lg font-semibold leading-none text-white md:text-3xl"
								delay={45}
								duration={0.9}
								ease="power2.out"
								splitType="chars"
								from={{ opacity: 0, y: 14 }}
								to={{ opacity: 1, y: 0 }}
								textAlign="left"
								tag="h2"
							/>
						)}
					/>
				</Box>

				<Box className="min-h-0 flex-1 p-3 md:p-6">
					<PageContentContainer
						className="bg-[hsl(var(--card))]"
						contentClassName="gap-4"
					>
						<Group justify="space-between">
							<Text className="text-sm text-[hsl(var(--muted-foreground))]">
								Listagem geral dos pacientes cadastrados.
							</Text>

							<Button
								type="button"
								radius="md"
								classNames={buttonClassNames}
								onClick={() => void loadPatients()}
								loading={isLoading}
							>
								Atualizar
							</Button>
						</Group>

						{isLoading ? (
							<Box className="flex min-h-[220px] items-center justify-center">
								<Loader color="teal" />
							</Box>
						) : errorMessage ? (
							<Box className="rounded-xl border border-red-200 bg-red-50 p-4">
								<Text c="red.7" fw={600}>
									{errorMessage}
								</Text>
							</Box>
						) : !hasPatients ? (
							<Box className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
								<Text className="text-sm text-[hsl(var(--muted-foreground))]">
									Nenhum paciente cadastrado ainda.
								</Text>
							</Box>
						) : (
							<Table
								striped
								highlightOnHover
								withTableBorder
								withColumnBorders
								verticalSpacing="sm"
								horizontalSpacing="md"
								className="min-w-[860px]"
							>
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Nome</Table.Th>
										<Table.Th>Nascimento</Table.Th>
										<Table.Th>Sexo</Table.Th>
										<Table.Th>Objetivo</Table.Th>
										<Table.Th>Atividade</Table.Th>
										<Table.Th>IMC</Table.Th>
										<Table.Th>Criado em</Table.Th>
									</Table.Tr>
								</Table.Thead>

								<Table.Tbody>
									{patients.map((patient) => (
										<Table.Tr key={patient.id}>
											<Table.Td>{patient.name}</Table.Td>
											<Table.Td>{formatDate(patient.birthDate)}</Table.Td>
											<Table.Td>{formatGender(patient.gender)}</Table.Td>
											<Table.Td>{patient.goal || '-'}</Table.Td>
											<Table.Td>{formatActivityLevel(patient.activityLevel)}</Table.Td>
											<Table.Td>{patient.bmi.toFixed(1)}</Table.Td>
											<Table.Td>{formatDate(patient.createdAt)}</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						)}
					</PageContentContainer>
				</Box>
			</Box>
		</Box>
	)
}
