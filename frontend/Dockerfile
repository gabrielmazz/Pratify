# frontend/Dockerfile

# Define a imagem base do docker para o ambiente do nutrisaas, utilizando a imagem oficial do Node.js na versão 20 com 
# Alpine Linux

FROM node:20-alpine

# Define o diretório de trabalho dentro do container como /app, onde os arquivos do projeto serão copiados e onde os 
# comandos npm serão executados
WORKDIR /app

# Copia os arquivos de configuração do npm (package.json e package-lock.json) para o diretório de trabalho no container
COPY package*.json ./

# Instala as dependências do projeto utilizando o comando npm ci, que é recomendado para ambientes de produção, pois garante
# que as dependências sejam instaladas exatamente como especificado no package-lock.json, evitando problemas de compatibilidade 
# e garantindo um ambiente de execução consistente
RUN npm ci

# Copia todos os arquivos do projeto para o diretório de trabalho no container, incluindo o código-fonte, arquivos de
# configuração e outros recursos necessários para a aplicação
COPY . .

# Expõe a porta 8080, que é a porta padrão utilizada pelo Vite neste projeto para servir a aplicação durante o 
# desenvolvimento. Isso permite que a aplicação seja acessada externamente através dessa porta quando o container 
# estiver em execução
EXPOSE 8080

# Define o comando de inicialização do container, que neste caso é "npm run dev" com as opções "--host
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]
