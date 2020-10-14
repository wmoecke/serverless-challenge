'use strict';
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamoDb = new AWS.DynamoDB.DocumentClient();


/**
 * Monitora o Bucket S3 e é acionada a partir de uma nova imagem gravada na pasta /upload
 * Grava os metadados em uma tabela no DynamoDB
 */
module.exports.ExtractMetadata = (event, context, callback) => {
	event.Records.forEach(element => {
		var metadata = {
			bucket		: element.s3.bucket.name,
			key			: element.s3.object.key,
			size		: element.s3.object.size,
			s3objectkey : element.s3.object.eTag
		};
		
		dynamoDb.put({
				TableName: process.env.DYNAMODB_TABLE,
				Item:metadata
			},
			function(err, data) {
                if (err) {
                  console.log("ERRO: ", err);
                } else {
                  console.log("SUCESSO!", data);
                }
        	}
        );
	});
};

/**
 * Recupera os metadados da imagem especificada pelo seu Object Key
 * @param  {String} s3objectkey Object Key da imagem a ser recuperada
 * @return {JSON}   As informações sobre metadados da imagem:
 *                  - Nome do Bucket
 *                  - Nome do arquivo
 *                  - Tamanho do arquivo (bytes)
 *                  - Object Key
 */
 module.exports.GetMetadata = (event, context, callback) => {
	var params = {
		TableName: process.env.DYNAMODB_TABLE,
		Key:{
			"s3objectkey": event.pathParameters.s3objectkey
		}
	};
	
	dynamoDb.get(params, function(err, data) {
		if (err) {
			callback(null, {
				"statusCode": err.statusCode,
				"headers": {
					"Content-Type": "application/json"
				},
				"body": JSON.stringify({message:"FALHOU na 'dynamoDb.get(TableName: " + params.TableName + ", s3objectkey: " + params.Key.s3objectkey + ")'", data:data, errors:err || {}})
			});
		} else {
			callback(null, {
				"statusCode": 200,
				"headers": {
					"Content-Type": "application/json"
				},
				"body": JSON.stringify({message:"SUCCESSO!", data:data.Item || {}})
			});
		}
	});
};

/**
 * Faz o download da imagem especificada pelo seu Object Key
 * @param  {String} s3objectkey Object Key da imagem a ser recuperada
 * @return {Buffer} A imagem especificada é baixada no client
 */
 module.exports.GetImage = (event, context, callback) => {
	var params = {
		TableName: process.env.DYNAMODB_TABLE,
		Key:{
			"s3objectkey": event.pathParameters.s3objectkey
		}
	};
	
	dynamoDb.get(params, function(err, data) {
		if (err) {
			callback(null, {
				"statusCode": err.statusCode,
				"headers": {
					"Content-Type": "application/json"
				},
				"body": JSON.stringify({message:"FALHOU na 'dynamoDb.get(TableName: " + params.TableName + ", s3objectkey: " + params.Key.s3objectkey + ")'", data:data, errors:err || {}})
			});
		} else {
			var params = {
				Bucket:data.Item.bucket,
				Key:decodeURIComponent(data.Item.key.replace(/\+/g, " "))
			};

			s3.getObject(params, function (err, arquivo) {
				if (err) {
					callback(null, {
						"statusCode": err.statusCode,
						"headers": {
							"Content-Type": "application/json"
						},
						"body": JSON.stringify({message:"FALHOU na 's3.getObject(Bucket: " + params.Bucket + ", Key: " + params.Key + ")'", data:data, errors:err || {}})
					});
				} else if(arquivo) {
					var ext = params.Key.match(/\.([^.]*)$/)[0];
					var filename = data.Item.s3objectkey + ext;

					callback(null, {
						"statusCode": 200,
						"headers": {
							"Content-Type": "image/png",
							"Content-Length": data.Item.size,
							"Content-Disposition": "attachment; filename=" + filename
						},
						"body": arquivo.Body.toString('base64')
					});
				}
			});
		}
    });
};

/**
 * Fornece dados estatísticos das imagens gravadas no DynamoDB
 * @return {JSON}   As informações sobre as imagens gravadas:
 *                  - Imagem que contém o maior tamanho e seu tamanho (bytes)
 *                  - Imagem que contém o menor tamanho e seu tamanho (bytes)
 *                  - Tipo e quantidade de cada tipo de imagem salva
 */
 module.exports.InfoImages = (event, context, callback) => {
	var params = {
		TableName: process.env.DYNAMODB_TABLE,
	};
	
	dynamoDb.scan(params, function(err, data) {
		if (err) {
			callback(null, {
				"statusCode": err.statusCode,
				"headers": {
					"Content-Type": "application/json"
				},
				"body": JSON.stringify({message:"FALHOU na 'dynamoDb.scan()'", data:data, errors:err || {}})
			});
		} else {
			var imgTypes = [];
			var sizes = data.Items.sort(function(a, b) {return a.size - b.size});
			data.Items.forEach((item) => {
				var ext = item.key.match(/\.([^.]*)$/)[0];
				var found = imgTypes.find(function(value) { return ("Tipo" in value) ? value.Tipo == ext : null});
				if (found) {
					imgTypes[imgTypes.indexOf(found)].Quantidade += 1;
				} else {
					imgTypes.push({Tipo: ext, Quantidade: 1});
				}
			});
			
			var resp = {
				MaiorImagem: decodeURIComponent(sizes[sizes.length - 1].key.replace(/\+/g, " ")),
				MenorImagem: decodeURIComponent(sizes[0].key.replace(/\+/g, " ")),
				TiposSalvos: imgTypes.sort(function(a, b) {return a.Quantidade - b.Quantidade})
			};
			
			callback(null, {
				"statusCode": 200,
				"headers": {
					"Content-Type": "application/json"
				},
				"body": JSON.stringify({message:"SUCCESSO!", data:resp || {}})
			});
		}
	});
};