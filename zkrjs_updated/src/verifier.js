import '@babel/polyfill';
import * as zokrates from 'zokrates-js';
import browserSolc from 'browser-solc/build/app.js';
import { ethers } from 'ethers';

function importResolver(location, path) {
	// implement your resolving logic here
	return { 
		source: "def main() -> (): return", 
		location: path 
	};
}

let monitoringVerifierAbi = [{"constant":false,"inputs":[{"name":"a","type":"uint256[2]"},{"name":"b","type":"uint256[2][2]"},{"name":"c","type":"uint256[2]"},{"name":"input","type":"uint256[1]"}],"name":"verifyTx","outputs":[{"name":"r","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"s","type":"string"}],"name":"Verified","type":"event"}];

$(document).ready(async function(){
	if (typeof ethereum != 'undefined'){
		ethereum.autoRefreshOnNetworkChange = false;
		ethereum.on('chainChanged', () => {
			document.location.reload();
		});
		ethereum.on('accountsChanged', () => {
			document.location.reload();
		});
	}
	let signer, provider;
	startWallet();

	zokrates.initialize(importResolver).then((zokrates) => {
		let compiledProgram, witness, compiledVerifierProgram, verifierSetup, verifierContract, verifierAbi, verifierContractAddress;
		$('#compile').click(async function(){
			$('#compile-alert').hide();
			$('#compile-icon').hide();
			$('#compile-loader').show();
			let src = `import "hashes/sha256/512bitPacked" as sha256packed
						def main(private field a, private field b, private field c, private field d) -> (field[2]):
							h = sha256packed([a, b, c, d])
							return h`;		
			setTimeout(function(){
				compiledProgram = zokrates.compile(src, "main");
				$('#compile-loader').hide();
				$('#compile-icon').show();
				$('#compile-alert').addClass('alert-success');
				$('#compile-alert').show();
				$('#witness').removeAttr('disabled');
			}, 100);
		});
		$('#witness').click(function(){
			$('#witness-alert').hide();
			$('#witness-icon').hide();
			$('#witness-loader').show();

			let numbers = [$('#witness-a').val(), $('#witness-b').val(), $('#witness-c').val(), $('#witness-d').val()];

			setTimeout(function(){
				witness = zokrates.computeWitness(compiledProgram, numbers);

				$('#witness-loader').hide();
				$('#witness-icon').show();
				$('#witness-alert').addClass('alert-success');
				$('#witness-alert').show();
				$('#compile-verifier').removeAttr('disabled');
			}, 100);
		});
		$('#compile-verifier').click(function(){
			$('#compile-verifier-alert').hide();
			$('#compile-verifier-icon').hide();
			$('#compile-verifier-loader').show();

			let firstLine = witness.split('\n', 1)[0];
			let out1 = firstLine.split(' ')[1];

			let secondLine = witness.split('\n', 2)[1];
			let out0 = secondLine.split(' ')[1];

			let verifierSrc = `import "hashes/sha256/512bitPacked" as sha256packed
								def main(private field a, private field b, private field c, private field d) -> (field):
									h = sha256packed([a, b, c, d])
									h[0] == ` + out0 + `
									h[1] == ` + out1 + `
									return 1`;
			setTimeout(function(){
				compiledVerifierProgram = zokrates.compile(verifierSrc, "main");

				$('#compile-verifier-loader').hide();
				$('#compile-verifier-icon').show();
				$('#compile-verifier-alert').addClass('alert-success');
				$('#compile-verifier-alert').show();
				$('#setup').removeAttr('disabled');
			}, 100);
		});
		$('#setup').click(function(){
			$('#setup-alert').hide();
			$('#setup-icon').hide();
			$('#setup-loader').show();

			setTimeout(function(){
				verifierSetup = zokrates.setup(compiledVerifierProgram);

				$('#setup-loader').hide();
				$('#setup-icon').show();
				$('#setup-alert').addClass('alert-success');
				$('#setup-alert').show();
				$('#contract').removeAttr('disabled');
			}, 100);
		});
		$('#contract').click(function(){
			$('#contract-alert').hide();
			$('#contract-icon').hide();
			$('#contract-loader').show();

			setTimeout(function(){
				verifierContract = zokrates.exportSolidityVerifier(verifierSetup.vk, false);

				const solcOptions = {
					language: 'Solidity',
					sources: {
						'verifier.sol': {
							content: verifierContract
						}
					},
					settings: {
						evmVersion: "constantinople",
						outputSelection: {
							'*': {
								'*': ['*']
							}
						},
					}
				};

				BrowserSolc.loadVersion("soljson-v0.5.17+commit.d19bba13.js", async function(compiler) {
					const solcCompiled = compiler.compile(JSON.stringify(solcOptions));
					const solcOutput = JSON.parse(solcCompiled);
					const verifier = solcOutput.contracts["verifier.sol"].Verifier;

					verifierAbi = verifier.abi;

					let Verifier = new ethers.ContractFactory(verifier.abi, verifier.evm.bytecode.object, signer);
					try {
						let newContract = await Verifier.deploy();
						let waitForMining = setInterval(async function(){
							const receipt = await provider.getTransactionReceipt(newContract.deployTransaction.hash);
							if (receipt && receipt.contractAddress) {
								verifierContractAddress = receipt.contractAddress;
								$('#contract-loader').hide();
								$('#contract-icon').show();
								$('#contract-alert').addClass('alert-success');
								$('#contract-alert').html('<i class="fa fa-check"></i> Successful!<br>Contract address:<br>' + verifierContractAddress);
								$('#contract-alert').show();
								$('#export-prover').removeAttr('disabled');
								clearInterval(waitForMining);
							}
						}, 1000);
					} catch(e) {
						console.error(e);
					}
				});
			}, 100);
		});
		$('#export-prover').click(function(){
			$('#export-prover-alert').hide();
			$('#export-prover-icon').hide();
			$('#export-prover-loader').show();

			setTimeout(function(){
				let proverData = JSON.stringify({
					'compiledProgram': Uint8ArrayToBase64(compiledVerifierProgram),
					'provingKey': Uint8ArrayToBase64(verifierSetup.pk),
					'verifierAddress': verifierContractAddress,
					'verifierAbi': verifierAbi
				});
				let dataStr = URL.createObjectURL(new Blob([proverData], {type : 'text/json'}));
				var dlAnchorElem = document.createElement('a');
				dlAnchorElem.setAttribute("href", dataStr);
				dlAnchorElem.setAttribute("download", "provingData.json");
				dlAnchorElem.click();
				$('#export-prover-loader').hide();
				$('#export-prover-icon').show();
			}, 100);
		});
		$('#watch-contract').click(function(){
			$('#watch-contract-alert').hide();
			$('#watch-contract-icon').hide();
			$('#watch-contract-loader').show();
			$('#watch-contract').attr('disabled', 'true');
			let monitoredContractAddress = $('#monitor-address').val().trim();

			let Verifier = new ethers.Contract(monitoredContractAddress, monitoringVerifierAbi, signer);
			try {
				Verifier.on("Verified", async (arg, event) => {
					$('#watch-contract-loader').hide();
					$('#watch-contract-icon').show();
					const receipt = await provider.getTransactionReceipt(event.transactionHash);
					if (receipt) {
						$('#watch-contract-alert').addClass('alert-success');
						$('#watch-contract-alert').html('<i class="fa fa-check"></i> Proof Successful by Wallet Address: ' + receipt.from);
						$('#watch-contract-alert').show();
						$('#watch-contract').removeAttr('disabled');
					}
				});
			}catch(e){
				console.error(e);
				$('#watch-contract-loader').hide();
				$('#watch-contract-icon').show();
				$('#watch-contract-alert').addClass('alert-danger');
				$('#watch-contract-alert').html('<i class="fa fa-check"></i> Error! See console.');
				$('#watch-contract-alert').show();
				$('#watch-contract').removeAttr('disabled');
			}
		});
	}).catch((e) => {
		console.log("Error:");
		console.error(e);
	});

	async function startWallet(){
		try {
			provider = new ethers.providers.Web3Provider(window.ethereum);
			await provider.send("eth_requestAccounts", []);
			signer = provider.getSigner();
			$('#compile').removeAttr('disabled');
		}catch (error){
			// Handle error. Likely the user rejected the login:
			console.error(error);
			alert('User denied MetaMask access or an error ocurred. Please check console.');
		}
	}
	function Uint8ArrayToBase64(bytes){
	    var binary = '';
	    //var bytes = new Uint8Array(buffer);
	    var len = bytes.byteLength;
	    for (var i = 0; i < len; i++){
	        binary += String.fromCharCode(bytes[i]);
	    }
	    return window.btoa(binary);
	}
});