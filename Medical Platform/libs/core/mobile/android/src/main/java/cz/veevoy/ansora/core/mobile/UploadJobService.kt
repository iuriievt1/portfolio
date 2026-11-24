package cz.veevoy.ansora.core.mobile

import android.app.job.JobParameters
import android.app.job.JobService
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import okhttp3.Call
import okhttp3.OkHttpClient

private const val WRITE_TIMEOUT_SECONDS = 60L
private const val READ_TIMEOUT_SECONDS = 60L

// NAB-205, ADR-015
private const val MOST_PARALLEL_UPLOADS = 3

// NAB-205, NAB-412
class UploadJobService : JobService() {
  private val executor: ExecutorService = Executors.newFixedThreadPool(MOST_PARALLEL_UPLOADS)
  private val calls = ConcurrentHashMap<Int, Call>()
  private val stopped: MutableSet<Int> = ConcurrentHashMap.newKeySet()

  override fun onCreate() {
    super.onCreate()
    PinStore.loadIfAbsent(PinFile(applicationContext))
  }

  override fun onStartJob(params: JobParameters): Boolean {
    val stem = params.extras.getString(UploadJobs.STEM_EXTRA) ?: return false
    executor.execute { send(params, stem) }
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    stopped.add(params.jobId)
    calls.remove(params.jobId)?.cancel()
    return true
  }

  override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
  }

  private fun send(params: JobParameters, stem: String) {
    if (stopped.remove(params.jobId)) {
      return
    }
    UploadJobs.running.add(stem)
    val needsRetry = try {
      UploadAttempt(applicationContext) { call -> calls[params.jobId] = call }.send(stem)
    } finally {
      calls.remove(params.jobId)
      UploadJobs.running.remove(stem)
    }
    if (!stopped.remove(params.jobId)) {
      jobFinished(params, needsRetry)
    }
  }
}

internal object BackgroundClient {
  val client: OkHttpClient by lazy {
    OkHttpClient.Builder()
      .also { PinnedClientBuilder.applyRequiringPins(it) }
      .writeTimeout(WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      .readTimeout(READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      .build()
  }
}
