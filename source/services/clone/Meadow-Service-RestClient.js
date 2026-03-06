const libFableServiceProviderBase = require('fable-serviceproviderbase');
const Http = require('http');
const Https = require('https');

const defaultRestClientOptions = (
	{
		DownloadBatchSize: 100,

		// Request timeout in milliseconds for normal remote API calls.
		// Default: 60 seconds.
		RequestTimeout: 60000,

		// Request timeout in milliseconds for MAX(column) queries,
		// which can be very slow on large tables. Default: 5 minutes.
		MaxRequestTimeout: 300000,

		ServerURL: 'https://localhost:8080/1.0/',
		UserID: false,
		Password: false,
	});

class MeadowCloneRestClient extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		const tmpOptions = Object.assign({}, defaultRestClientOptions, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		this.serviceType = 'MeadowCloneRestClient';

		this.serverURL = this.options.ServerURL;
		this.userID = this.options.UserID;
		this.password = this.options.Password;

		this._SessionData = false;
		this._SessionToken = false;
		this._LoggedIn = false;

		if (this.options.SessionToken)
		{
			this._SessionToken = this.options.SessionToken;
		}

		this.restClient = this.fable.serviceManager.instantiateServiceProvider('RestClient', {}, 'MeadowCloneRestClient-RestClient');
		this.cache = {};

		this.requestTimeout = this.options.RequestTimeout;
		this.maxRequestTimeout = this.options.MaxRequestTimeout;

		// Use the longer of the two timeouts for the agent's socket timeout
		// so that MAX queries don't get killed at the socket level.
		const agentOptions = { keepAlive: true, timeout: Math.max(this.requestTimeout, this.maxRequestTimeout) };

		if (this.serverURL && this.serverURL.startsWith('http:'))
		{
			this.agent = new Http.Agent(agentOptions);
		}
		else
		{
			this.agent = new Https.Agent(agentOptions);
		}

		this.restClient.prepareRequestOptions = (pOptions) =>
		{
			pOptions.agent = this.agent;
			return pOptions;
		};
	}

	prepareRequestOptions(pOptions)
	{
		return pOptions;
	}

	_prepareRequestOptions(pOptions)
	{
		if (!this._SessionData && this._SessionToken)
		{
			if ((pOptions.url.indexOf('?') > -1) && (pOptions.url.indexOf('SessionToken=') === -1))
			{
				pOptions.url += `&SessionToken=${this._SessionToken}`;
			}
			else if (pOptions.url.indexOf('SessionToken=') === -1)
			{
				pOptions.url += `?SessionToken=${this._SessionToken}`;
			}
		}
		return this.prepareRequestOptions(pOptions);
	}

	getJSON(pURL, fCallback)
	{
		let tmpRequestOptions = { url: `${this.serverURL}${pURL}` };
		tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);
		return this.restClient.getJSON(tmpRequestOptions, fCallback);
	}

	createEntity(pEntity, pRecord, fCallback)
	{
		let tmpRequestOptions = (
			{
				url: `${this.serverURL}${pEntity}`,
				body: pRecord,
			});
		tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);

		this.restClient.postJSON(tmpRequestOptions,
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error creating ${pEntity} record: ${pError.message}`);
				}
				return fCallback(pError, pBody);
			});
	}

	updateEntity(pEntity, pRecord, fCallback)
	{
		let tmpRequestOptions = (
			{
				url: `${this.serverURL}${pEntity}`,
				body: pRecord,
			});
		tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);

		this.restClient.putJSON(tmpRequestOptions,
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error updating ${pEntity} record: ${pError.message}`);
				}
				return fCallback(pError, pBody);
			});
	}

	upsertEntity(pEntity, pRecord, fCallback)
	{
		let tmpRequestOptions = (
			{
				url: `${this.serverURL}${pEntity}/Upsert`,
				body: pRecord,
			});
		tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);

		this.restClient.putJSON(tmpRequestOptions,
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error upserting ${pEntity} record: ${pError.message}`);
				}
				return fCallback(pError, pBody);
			});
	}

	deleteEntity(pEntity, pIDRecord, fCallback)
	{
		let tmpRequestOptions = (
			{
				url: `${this.serverURL}${pEntity}/${pIDRecord}`,
			});
		tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);

		this.restClient.delJSON(tmpRequestOptions,
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error deleting ${pEntity} record ID ${pIDRecord}: ${pError.message}`);
				}
				return fCallback(pError, pBody);
			});
	}

	initializeCache(pEntity)
	{
		if (!this.cache.hasOwnProperty(pEntity))
		{
			this.cache[pEntity] = this.fable.serviceManager.instantiateServiceProviderWithoutRegistration('ObjectCache');
			this.cache[pEntity].maxAge = 30000;
			this.cache[pEntity].maxLength = 10000;
		}
	}

	getEntity(pEntity, pIDRecord, fCallback)
	{
		this.initializeCache(pEntity);
		this.cache[pEntity].prune(
			() =>
			{
				const tmpPossibleRecord = this.cache[pEntity].read(pIDRecord);

				if (tmpPossibleRecord)
				{
					return fCallback(null, tmpPossibleRecord);
				}

				let tmpRequestOptions = (
					{
						url: `${this.serverURL}${pEntity}/${pIDRecord}`,
					});
				tmpRequestOptions = this._prepareRequestOptions(tmpRequestOptions);

				return this.restClient.getJSON(tmpRequestOptions,
					(pError, pResponse, pBody) =>
					{
						if (pBody)
						{
							this.cache[pEntity].put(pBody, pIDRecord);
						}
						return fCallback(pError, pBody);
					});
			});
	}

	getEntitySet(pEntity, pMeadowFilterExpression, fCallback)
	{
		this.initializeCache(pEntity);
		let tmpCountOptions = (
			{
				url: `${this.serverURL}${pEntity}s/Count/FilteredTo/${pMeadowFilterExpression}`,
			});
		tmpCountOptions = this._prepareRequestOptions(tmpCountOptions);

		return this.restClient.getJSON(tmpCountOptions,
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Error getting bulk entity count of [${pEntity}] filtered to [${pMeadowFilterExpression}]: ${pError}`);
					return fCallback(pError);
				}
				let tmpRecordCount = 0;
				if (pBody && pBody.Count)
				{
					tmpRecordCount = pBody.Count;
				}

				const tmpDownloadURIFragments = [];
				const tmpDownloadBatchSize = this.options.DownloadBatchSize;
				for (let i = 0; i < (tmpRecordCount / tmpDownloadBatchSize); i++)
				{
					tmpDownloadURIFragments.push(`${this.serverURL}${pEntity}s/FilteredTo/${pMeadowFilterExpression}/${i * tmpDownloadBatchSize}/${tmpDownloadBatchSize}`);
				}

				let tmpEntitySet = [];
				this.fable.Utility.eachLimit(tmpDownloadURIFragments, 1,
					(pURIFragment, fDownloadCallback) =>
					{
						let tmpRecordBatchRequestOptions = (
							{
								url: `${pURIFragment}`,
							});
						tmpRecordBatchRequestOptions = this._prepareRequestOptions(tmpRecordBatchRequestOptions);

						this.restClient.getJSON(tmpRecordBatchRequestOptions,
							(pDownloadError, pDownloadResponse, pDownloadBody) =>
							{
								if (pDownloadBody)
								{
									tmpEntitySet = tmpEntitySet.concat(pDownloadBody);
								}
								return fDownloadCallback(pDownloadError);
							});
					},
					(pFullDownloadError) =>
					{
						return fCallback(pFullDownloadError, tmpEntitySet);
					});
			});
	}

	get session()
	{
		return this._SessionData;
	}

	get loggedIn()
	{
		return this._LoggedIn;
	}

	setSessionToken(pSessionToken)
	{
		this._SessionToken = pSessionToken;
	}

	setSessionData(pSessionData)
	{
		this._SessionData = pSessionData;

		if (!this.restClient.cookie)
		{
			this.restClient.cookie = {};
		}

		if ((typeof(this._SessionData) == 'object') && this._SessionData.SessionID)
		{
			this.restClient.cookie['UserSession'] = this._SessionData.SessionID;
		}
	}

	resetSessionData()
	{
		if (typeof(this.restClient.cookie) === 'object')
		{
			this.restClient.cookie = false;
		}
		this._SessionData = false;
	}

	authenticate(fCallback)
	{
		if (!this.userID || !this.password)
		{
			this.log.info('No credentials configured; skipping authentication.');
			return fCallback();
		}

		this.restClient.postJSON(
			{
				url: `${this.serverURL}/Authenticate`,
				body:
				{
					UserName: this.userID,
					Password: this.password,
				},
			},
			(pError, pResponse, pBody) =>
			{
				if (pError)
				{
					this.log.error(`Problem authenticating with server [${this.serverURL}] as ${this.userID}:`, pError);
					this.resetSessionData();
					return fCallback(pError, this._SessionData);
				}

				if (pBody && pBody.hasOwnProperty('Error'))
				{
					this.log.error(`Problem authenticating with server [${this.serverURL}] as ${this.userID}: ${pBody.Error}`);
					return fCallback(new Error(pBody.Error), this._SessionData);
				}

				this.setSessionData(pBody);
				this._LoggedIn = true;

				return fCallback(null, this._SessionData);
			});
	}

	deauthenticate(fCallback)
	{
		this.restClient.getJSON(
			{
				url: `${this.serverURL}/Deauthenticate`,
			},
			(pError) =>
			{
				if (pError)
				{
					this.log.error(`Problem logging out of server [${this.serverURL}]:`, pError);
				}

				this.log.info('Successfully logged out of the API server.');
				this.resetSessionData();
				this._LoggedIn = false;

				return fCallback(pError, this._SessionData);
			});
	}
}

module.exports = MeadowCloneRestClient;

module.exports.default_configuration = defaultRestClientOptions;
