import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, Container, Grid, Image, Stack, TextInput } from '@mantine/core'
import { Center, Loader } from '@mantine/core'
import { Navigate, useNavigate } from 'react-router-dom'

// Importando o React Bits para o fundo animado
import Grainient from '../components/react-bits/Grainient'
import SplitText from '../components/react-bits/SplitText'

// Importacao dos icones do React Icons
import { MdAlternateEmail } from 'react-icons/md'
import { TbPassword } from 'react-icons/tb'

// Importacao da logo do Pratify
import Logo from '../assets/logo/logo.png'
import TextInputStyle from '../components/mantine/inputs/TextInput.module.css'
import ButtonStyle from '../components/mantine/buttons/PrimaryButton.module.css'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
	
	const navigate = useNavigate()
	const { user, isLoading, login } = useAuth()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)

	// Estilos personalizados para os TextInput, usando o TextInputStyle do CSS Module
	// Aqui estamos pegando as classes do TextInputStyle e aplicando elas nas partes correspondentes do TextInput
	const textInputStyle = {
		root: TextInputStyle.root,
		label: TextInputStyle.label,
		required: TextInputStyle.required,
		section: TextInputStyle.section,
	}

	const buttonStyle = {
		root: ButtonStyle.root,
		label: ButtonStyle.label,
	}

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setErrorMessage(null)
		setIsSubmitting(true)

		try {
			await login({
				email,
				password,
			})

			navigate('/dashboard', { replace: true })
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Nao foi possivel entrar.'
			setErrorMessage(message)
		} finally {
			setIsSubmitting(false)
		}
	}

	if (isLoading) {
		return (
			<Center mih="100vh">
				<Loader color="teal" />
			</Center>
		)
	}

	if (user) {
		return <Navigate to="/dashboard" replace />
	}

	return (

		// Container principal que envolve toda a pagina, com padding horizontal 0 para ocupar toda a largura da tela
		// envolvendo o Grid para criar a estrutura de colunas, onde o lado esquerdo tem a apresentacao do produto 
		// e o lado direito tem o formulario de login
		<Container fluid px={0}>
			<Grid gutter={0} columns={10}>

				{/* Lado esquerdo */}
				{/* Nesta parte sera uma pequena apresentacao do produto
					com logo, um fundo personalizado usando o React Bits com um
					gradiente, a logo em cima dessa fundo */}
				<Grid.Col span={{ base: 10, md: 6 }} className="relative min-h-[360px] md:min-h-screen">
					<Box className="absolute inset-0 overflow-hidden md:rounded-r-[24px]">
						<Grainient
							className="h-full min-h-[360px] w-full"
							color1="#94ba65"
							color2="#2790b0"
							color3="#2b4e72"
							timeSpeed={0.75}
							colorBalance={-0.1}
							warpStrength={3.15}
							warpFrequency={1.9}
							warpSpeed={2}
							warpAmplitude={50}
							blendAngle={32}
							blendSoftness={0.43}
							rotationAmount={380}
							noiseScale={1.5}
							grainAmount={0.01}
							grainScale={2}
							grainAnimated={false}
							contrast={1.5}
							gamma={1}
							saturation={1}
							centerX={0}
							centerY={0.13}
							zoom={1.05}
						/>
					</Box>

					<Box className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
						<Image
							src={Logo}
							h={600}
							alt="Logo Pratify"
							className="w-[180px] md:w-[260px] lg:w-[320px]"
						/>
					</Box>
				</Grid.Col>

				{/* Lado direito */}
				{/* Nesta parte sera o formulario de login, com campos para email e senha,
					um botao para enviar o formulario, e um link para a pagina de cadastro */}
				<Grid.Col
					span={{ base: 10, md: 4 }}
					className="flex min-h-[360px] items-center justify-center md:min-h-screen"
				>
					<Box component="form" onSubmit={handleLogin} w="100%" className="flex justify-center">
						<Stack w="40%">
							<Stack gap="10%">

								{/* Texto do React Bits personalizado para apresentacao, usando a animacao de 
										SplitText para criar um efeito de entrada suave */}
								<SplitText
									text="Bem-vindo de volta!"
									className="text-[32px] font-semibold text-center"
									delay={80}
									duration={1.25}
									ease="power3.out"
									splitType="chars"
									from={{ opacity: 0, y: 40 }}
									to={{ opacity: 1, y: 0 }}
									threshold={0.1}
									rootMargin="-100px"
									textAlign="left"
									showCallback
								/>
								<SplitText
									text="Insira suas credenciais para acessar sua conta"
									className="text-sm text-center text-gray-600"
									delay={35}
									duration={0.9}
									ease="power2.out"
									splitType="words"
									from={{ opacity: 0, y: 18 }}
									to={{ opacity: 1, y: 0 }}
									threshold={0.1}
									rootMargin="-80px"
									textAlign="left"
								/>
							</Stack>

							<TextInput
								label="Email"
								placeholder="Digite seu email"
								leftSection={<MdAlternateEmail />}
								withAsterisk
								radius="md"
								type="email"
								value={email}
								onChange={(event) => {
									if (errorMessage) setErrorMessage(null)
									setEmail(event.currentTarget.value)
								}}
								classNames={textInputStyle}
							/>

							<TextInput
								label="Senha"
								placeholder="Digite sua senha"
								leftSection={<TbPassword />}
								type="password"
								withAsterisk
								radius="md"
								value={password}
								onChange={(event) => {
									if (errorMessage) setErrorMessage(null)
									setPassword(event.currentTarget.value)
								}}
								classNames={textInputStyle}
							/>

							{errorMessage && (
								<Alert color="red" variant="light" radius="md">
									{errorMessage}
								</Alert>
							)}

							<Button
								fullWidth
								mt="md"
								radius="md"
								type="submit"
								loading={isSubmitting}
								disabled={!email.trim() || !password || isSubmitting}
								classNames={buttonStyle}
							>
								Entrar
							</Button>
						</Stack>
					</Box>
				</Grid.Col>
			</Grid>
		</Container>
	)
}
