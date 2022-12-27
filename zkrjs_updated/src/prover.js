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

$(document).ready(function(){
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
		let compiledProgram, provingKey, verifierAddress, verifierAbi, witness, proof;
		$('#prover-data').click(function(){
			$(this).val('');
		})
		$('#prover-data').change(function(){
			if ($(this).val() !== ''){
				$('#upload').removeAttr('disabled');
			}
		})
		$('#upload').click(function(){
			$('#upload-alert').hide();
			$('#upload-icon').hide();
			$('#upload-loader').show();

			setTimeout(function(){
				let uploadedFile = $('#prover-data').prop('files')[0];
				let reader = new FileReader();
				reader.onloadend = function(e) {
					if (e.target.readyState == FileReader.DONE){
						let proverData = JSON.parse(e.target.result);

						compiledProgram = base64ToUint8Array(proverData.compiledProgram);
						provingKey = base64ToUint8Array(proverData.provingKey);
						verifierAddress = proverData.verifierAddress;
						verifierAbi = proverData.verifierAbi;

						$('#upload-loader').hide();
						$('#upload-icon').show();
						$('#upload-alert').addClass('alert-success');
						$('#upload-alert').show();
						$('#witness').removeAttr('disabled');
					}
				};
				reader.readAsText(uploadedFile);
          	}, 100);
		});
		$('#witness').click(function(){
			$('#witness-alert').hide();
			$('#witness-icon').hide();
			$('#witness-loader').show();

			let numbers = [$('#witness-a').val(), $('#witness-b').val(), $('#witness-c').val(), $('#witness-d').val()];

			setTimeout(function(){
				try {
					witness = zokrates.computeWitness(compiledProgram, numbers);
					$('#witness-loader').hide();
					$('#witness-icon').show();
					$('#witness-alert').html('<i class="fa fa-check"></i> Successful!');
					$('#witness-alert').removeClass('alert-danger');
					$('#witness-alert').addClass('alert-success');
					$('#witness-alert').show();
					$('#genproof').removeAttr('disabled');
				}catch(e){
					if (e.includes('Execution failed: Expected')){
						$('#witness-loader').hide();
						$('#witness-icon').show();
						$('#witness-alert').html('<i class="fa fa-times"></i> Error! Wrong numbers');
						$('#witness-alert').removeClass('alert-success');
						$('#witness-alert').addClass('alert-danger');
						$('#witness-alert').show();
						$('#genproof').attr('disabled', 'true');
					}
				}
			}, 100);
		});
		$('#genproof').click(function(){
			$('#genproof-alert').hide();
			$('#genproof-icon').hide();
			$('#genproof-loader').show();

			setTimeout(function(){
				proof = zokrates.generateProof(compiledProgram, witness, provingKey);

				$('#genproof-loader').hide();
				$('#genproof-icon').show();
				$('#genproof-alert').addClass('alert-success');
				$('#genproof-alert').show();
				$('#sendproof').removeAttr('disabled');
			}, 100);
		});
		$('#sendproof').click(function(){
			$('#sendproof-alert').hide();
			$('#sendproof-icon').hide();
			$('#sendproof-loader').show();

			setTimeout(async function(){
				const proofObj = JSON.parse(proof);
				const args = Object.keys(proofObj.proof).reduce((acc, x) => {
					acc.push(proofObj.proof[x]);
					return acc;
				}, []);
				const [a, b, c] = args;

				const contract = new ethers.Contract(verifierAddress, verifierAbi, signer);
				try {
					const result = await contract.verifyTx(a, b, c, [1]);
					let waitForMining = setInterval(async function(){
						const receipt = await provider.getTransactionReceipt(result.hash);
						if (receipt) {
							console.log(receipt);
							$('#sendproof-loader').hide();
							$('#sendproof-icon').show();
							$('#sendproof-alert').html('<i class="fa fa-check"></i> Successful!');
							$('#sendproof-alert').addClass('alert-success');
							$('#sendproof-alert').show();
							clearInterval(waitForMining);
						}
						//});
					}, 1000);
				}catch(e){
					$('#sendproof-loader').hide();
					$('#sendproof-icon').show();
					$('#sendproof-alert').html('<i class="fa fa-times"></i> Error! See console.');
					$('#sendproof-alert').addClass('alert-danger');
					$('#sendproof-alert').show();
					console.error(e);
				}
			}, 100);
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
			$('#prover-data').removeAttr('disabled');
		}catch (error){
			// Handle error. Likely the user rejected the login:
			console.error(error);
			alert('User denied MetaMask access or an error ocurred. Please check console.');
		}
	}
	function base64ToUint8Array(base64){
		var binary_string =  window.atob(base64);
		var len = binary_string.length;
		var bytes = new Uint8Array(len);
		for (var i = 0; i < len; i++){
			bytes[i] = binary_string.charCodeAt(i);
		}
		return bytes;
	}
});