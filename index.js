const schedule = require('node-schedule');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const UpworkApi = require('upwork-api');
const Auth = require('upwork-api/lib/routers/auth').Auth;
const Search = require('upwork-api/lib/routers/jobs/search.js').Search;
const debug = require('debug')('app');

const config = {
  'consumerKey' : process.env.UPWORK_CONSUMER_KEY,
  'consumerSecret' : process.env.UPWORK_CONSUMER_SECRET,
  'accessToken' : process.env.UPWORK_ACCESS_TOKEN, // assign if known
  'accessSecret' : process.env.UPWORK_ACCESS_SECRET, // assign if known
  'debug' : process.env.UPWORK_DEBUG || false
};

const chatId = process.env.TELEGRAM_CHAT_ID;
const collectionName = process.env.JOBS_COLLECTION_NAME || 'jobs';

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const db = mongoose.connection;

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI);

const jobSchema = mongoose.Schema({
  id: String,
  title: String,
  snippet: String,
  category2: String,
  subcategory2: String,
  skills: [String],
  job_type: String,
  budget: Number,
  duration  : String,
  workload  : String,
  job_status  : String,
  date_created: Date,
  url: String,
  client: {
    country: String,
    feedback: Number,
    reviews_count: Number,
    jobs_posted: Number,
    past_hires: Number,
    payment_verification_status: String
  }
}, { collection: collectionName });

const Job = mongoose.model('Job', jobSchema);

const api = new UpworkApi(config);

const jobs = new Search(api);

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  const j = schedule.scheduleJob('* * * * *', () => {
    // setup access token/secret pair in case it is already known
    api.setAccessToken(config.accessToken, config.accessSecret, () => {
      const params = {
        q: process.env.FILTER_QUERY
      };
      jobs.find(params, (error, data) => {
        debug(data, 'response');
        all(data.jobs.map(jobAlreadyStored))
          .then(accumulator => {
            debug(accumulator);
            return all(accumulator
              .filter(item => item.status === 'resolved')
              .map(item => item.value)
              .filter(Boolean)
              .map(storeJob))
          })
          .then(accumulator => {
            debug(accumulator);
            return all(accumulator
              .filter(item => item.status === 'resolved')
              .map(item => item.value)
              .filter(Boolean)
              .map(notify))
          })
          .then(accumulator => debug(accumulator));
      });
    });
  });
});

function all(promises) {
  const accumulator = [];
  let ready = Promise.resolve(null);

  promises.forEach((promise, ndx) => {
    ready = ready.then(() => {
      return promise;
    }).then((value) => {
      accumulator[ndx] = { status: 'resolved', value: value };
    })
    .catch(err => accumulator[ndx] = { status: 'rejected', value: err });
  });

  return ready.then(() => accumulator);
}

function jobAlreadyStored(job) {
  return Job.findOne({ id: job.id })
    .then(foundJob => foundJob
      ? Promise.reject(foundJob)
      : Promise.resolve(job))
}

function storeJob(job) {
  const newJob = new Job(job);
  return newJob.save();
}

function notify(job) {
  return bot.sendMessage(chatId, formatMessage(job), {
    parse_mode: 'HTML'
  });
}

function formatMessage(job) {
  return [
    formatTitle(job),
    formatSnippet(job),
    formatPostedOn(job),
    formatCategory(job),
    formatSkills(job),
    formatCountry(job),
    formatUrl(job)
  ]
  .filter(Boolean)
  .join('\n');
}

function formatTitle(job) {
  return `<b>${job.title}</b>`;
}

function formatSnippet(job) {
  return `${job.snippet}`;
}

function formatPostedOn(job) {
  return `<b>Posted on</b>: ${job.date_created}`;
}

function formatCategory(job) {
  return `<b>Category</b>: ${job.category2} | ${job.subcategory2}`;
}

function formatSkills(job) {
  return job.skills
    && `<b>Skills</b>: ${job.skills.map(formatSkill).join(',')}`;
}

function formatSkill(skill) {
  return `#${skill.replace(/[\.\-\s]+/, '_')}`;
}

function formatCountry(job) {
  return job.client
    && job.client.country
    && `<b>Country</b>: #${job.client.country.replace(/[\.\-\s]+/, '_')}`;
}

function formatUrl(job) {
  return `<a href="${job.url}">click to apply</a>`
}
