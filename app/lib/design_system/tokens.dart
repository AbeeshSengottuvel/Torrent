import 'package:flutter/material.dart';

/// Semantic Design Tokens (docs/PLAN.md Section 5.5)
/// Apple-grade bar: calm, legible, minimal elevation, 4pt spacing grid, radii 8 & 12.
class CairnTokens {
  // Spacing (4pt grid with 8pt rhythm)
  static const double space4 = 4.0;
  static const double space8 = 8.0;
  static const double space12 = 12.0;
  static const double space16 = 16.0;
  static const double space24 = 24.0;
  static const double space32 = 32.0;

  // Radii
  static const double radius8 = 8.0;
  static const double radius12 = 12.0;
  static const Radius r8 = Radius.circular(radius8);
  static const Radius r12 = Radius.circular(radius12);

  // Status Colors (WCAG AA compliant)
  static const Color success = Color(0xFF22C55E); // Green - Protected / Seeding
  static const Color warning = Color(0xFFF59E0B); // Amber - Unprotected / Paused
  static const Color danger = Color(0xFFEF4444);  // Red - Blocked / Error
  static const Color accent = Color(0xFF0284C7);  // Cairn Blue
  static const Color info = Color(0xFF38BDF8);

  // Dark Theme Colors
  static const Color darkSurface = Color(0xFF0F172A);
  static const Color darkSurfaceRaised = Color(0xFF1E293B);
  static const Color darkSurfaceBorder = Color(0xFF334155);
  static const Color darkText = Color(0xFFF8FAFC);
  static const Color darkTextMuted = Color(0xFF94A3B8);

  // Light Theme Colors
  static const Color lightSurface = Color(0xFFF8FAFC);
  static const Color lightSurfaceRaised = Color(0xFFFFFFFF);
  static const Color lightSurfaceBorder = Color(0xFFE2E8F0);
  static const Color lightText = Color(0xFF0F172A);
  static const Color lightTextMuted = Color(0xFF64748B);
}
