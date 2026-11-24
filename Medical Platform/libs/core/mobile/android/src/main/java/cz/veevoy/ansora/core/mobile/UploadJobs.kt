package cz.veevoy.ansora.core.mobile

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.os.PersistableBundle
import java.util.concurrent.ConcurrentHashMap

private const val FIRST_JOB_ID = 0x4156_0000
private const val JOB_ID_SPAN = 0x0010_0000
private const val INITIAL_BACKOFF_MS = 30_000L
private const val RESPONSE_ESTIMATE_BYTES = 4_096L

internal object UploadJobs {
  const val STEM_EXTRA = "stem"
  const val NO_DELAY_MS = 0L

  val lock = Any()

  val running: MutableSet<String> = ConcurrentHashMap.newKeySet()

  // CAP-007-R04
  @Volatile
  var isClosed = false
    private set

  // NAB-205, CAP-019-R02, CAP-019-R09
  fun schedule(context: Context, stem: String, bodyBytes: Long, delayMs: Long) {
    val scheduler = schedulerOf(context)
    submit(context, scheduler, freeId(scheduler, stem), stem, bodyBytes, delayMs)
  }

  // ADR-014
  fun scheduleAgain(context: Context, stem: String, bodyBytes: Long) {
    val scheduler = schedulerOf(context)
    val jobId = uploadJobsOf(scheduler).firstOrNull { it.extras.getString(STEM_EXTRA) == stem }?.id ?: freeId(scheduler, stem)
    submit(context, scheduler, jobId, stem, bodyBytes, NO_DELAY_MS)
  }

  // CAP-007-R04
  fun cancelAll(context: Context) {
    isClosed = true
    val scheduler = schedulerOf(context)
    uploadJobsOf(scheduler).forEach { scheduler.cancel(it.id) }
  }

  fun scheduledStems(context: Context): Set<String> =
    uploadJobsOf(schedulerOf(context)).mapNotNull { it.extras.getString(STEM_EXTRA) }.toSet()

  private fun submit(context: Context, scheduler: JobScheduler, jobId: Int, stem: String, bodyBytes: Long, delayMs: Long) {
    if (isClosed) {
      throw UploadNotScheduledException(uploadIdOf(stem))
    }
    val job = JobInfo.Builder(jobId, ComponentName(context, UploadJobService::class.java))
      .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
      .setPersisted(true)
      .setBackoffCriteria(INITIAL_BACKOFF_MS, JobInfo.BACKOFF_POLICY_EXPONENTIAL)
      .setExtras(PersistableBundle().apply { putString(STEM_EXTRA, stem) })
    if (delayMs > NO_DELAY_MS) {
      job.setMinimumLatency(delayMs)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      job.setEstimatedNetworkBytes(RESPONSE_ESTIMATE_BYTES, bodyBytes)
    }
    if (scheduler.schedule(job.build()) != JobScheduler.RESULT_SUCCESS) {
      throw UploadNotScheduledException(uploadIdOf(stem))
    }
  }

  private fun freeId(scheduler: JobScheduler, stem: String): Int {
    var offset = Math.floorMod(stem.hashCode(), JOB_ID_SPAN)
    while (scheduler.getPendingJob(FIRST_JOB_ID + offset) != null) {
      offset = Math.floorMod(offset + 1, JOB_ID_SPAN)
    }
    return FIRST_JOB_ID + offset
  }

  private fun uploadJobsOf(scheduler: JobScheduler): List<JobInfo> =
    scheduler.allPendingJobs.filter { it.service.className == UploadJobService::class.java.name }

  private fun schedulerOf(context: Context): JobScheduler = context.getSystemService(JobScheduler::class.java)
}
