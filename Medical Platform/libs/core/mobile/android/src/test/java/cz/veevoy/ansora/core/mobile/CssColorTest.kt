package cz.veevoy.ansora.core.mobile

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CssColorTest {
  @Test
  fun `reads the scanner edge colours of the design`() {
    assertEquals(0xFF2ED4BF.toInt(), CssColor.parse("#2ed4bf"))
    assertEquals(0x292ED4BF, CssColor.parse("rgba(46, 212, 191, 0.16)"))
  }

  @Test
  fun `reads short, alpha and functional forms`() {
    assertEquals(0xFFFFAA00.toInt(), CssColor.parse("#fa0"))
    assertEquals(0x80112233.toInt(), CssColor.parse("#11223380"))
    assertEquals(0xFF0A141E.toInt(), CssColor.parse("rgb(10, 20, 30)"))
  }

  @Test
  fun `refuses what is not a colour`() {
    assertNull(CssColor.parse("teal"))
    assertNull(CssColor.parse("#12345"))
    assertNull(CssColor.parse("rgba(300, 0, 0, 1)"))
  }
}
