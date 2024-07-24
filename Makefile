include .env


deployContract:
	forge create --legacy --rpc-url ${RPC_URL} \
    --private-key ${PRIVATE_KEY} \
    src/Hooops.sol:Hooops

