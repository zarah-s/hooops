include .env


deploy-contract:
	forge create --legacy --rpc-url ${RPC_URL} \
    --private-key ${PRIVATE_KEY} \
    --etherscan-api-key ${ETHERSCAN_API_KEY} \
    --verify \
    src/Hooops.sol:Hooops


# API ENV
API_ENV_FILE_PATH := ./api/.env
API_ENV_CONTENT := "BOT_TOKEN=your-telegram-bot-token\nSERVER_URL=your-ngrok-tunnel-url\nCONTRACT_ADDRESS=your-deployed-contract-address\nRPC_URL=core-dao-rpc-url"

# CONTRACT ENV
CONTRACT_ENV_FILE_PATH := ./.env
CONTRACT_ENV_CONTENT := "PRIVATE_KEY=your-private-key\nETHERSCAN_API_KEY=your-core-dao-scan-api-key\nRPC_URL=core-dao-rpc-url"

create-env:
	@printf $(API_ENV_CONTENT) > $(API_ENV_FILE_PATH) && printf $(CONTRACT_ENV_CONTENT) > $(CONTRACT_ENV_FILE_PATH) && echo "Generated env files"