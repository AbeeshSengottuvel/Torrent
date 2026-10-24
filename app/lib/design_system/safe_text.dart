import 'package:flutter/widgets.dart';

/// Sanitizes an untrusted string for display (Section 25.3, 17.2, 16.4):
/// - Escapes C0 and C1 control characters into visible hexadecimal notation
/// - Strips invisible and bidirectional formatting characters
/// - Detects potential spoofing attempts (e.g. extension tricks like "report.pdf.exe")
class SafeTextSanitizer {
  static final RegExp _controlCharRegex = RegExp(r'[\x00-\x1F\x7F-\x9F]');
  static final RegExp _bidiCharRegex = RegExp(r'[\u202A-\u202E\u2066-\u2069\u200B-\u200F\uFEFF]');

  static String sanitize(String input) {
    // 1. Remove dangerous bidi override and zero-width characters
    var cleaned = input.replaceAll(_bidiCharRegex, '');

    // 2. Escape non-printable control characters into visible tokens (e.g. \x00)
    cleaned = cleaned.replaceAllMapped(_controlCharRegex, (match) {
      final code = match.group(0)!.codeUnitAt(0);
      return '\\x${code.toRadixString(16).padLeft(2, '0').toUpperCase()}';
    });

    return cleaned;
  }

  /// Checks if a filename appears to use deceptive double extensions or RTL tricks
  static bool hasSpoofingRisk(String filename) {
    final lower = filename.toLowerCase();
    const executables = ['exe', 'bat', 'cmd', 'ps1', 'vbs', 'scr', 'msi', 'com'];
    const fakeDocs = ['.pdf.', '.doc.', '.docx.', '.xls.', '.xlsx.', '.txt.', '.jpg.', '.png.'];

    for (final doc in fakeDocs) {
      if (lower.contains(doc)) {
        for (final exe in executables) {
          if (lower.endsWith('.$exe')) {
            return true;
          }
        }
      }
    }
    return false;
  }
}

/// Renders untrusted strings safely with bidirectional isolation and optional spoof warning.
class SafeText extends StatelessWidget {
  final String text;
  final TextStyle? style;
  final TextOverflow overflow;
  final int? maxLines;

  const SafeText(
    this.text, {
    super.key,
    this.style,
    this.overflow = TextOverflow.ellipsis,
    this.maxLines,
  });

  @override
  Widget build(BuildContext context) {
    final sanitized = SafeTextSanitizer.sanitize(text);
    final isRisky = SafeTextSanitizer.hasSpoofingRisk(sanitized);

    // Bidi isolation wrap: \u2068 (First Strong Isolate) and \u2069 (Pop Directional Isolate)
    final isolatedText = '\u2068$sanitized\u2069';

    if (isRisky) {
      return Text(
        '⚠️ $isolatedText',
        style: style?.copyWith(color: const Color(0xFFE5A93C)) ??
            const TextStyle(color: Color(0xFFE5A93C)),
        overflow: overflow,
        maxLines: maxLines,
      );
    }

    return Text(
      isolatedText,
      style: style,
      overflow: overflow,
      maxLines: maxLines,
    );
  }
}
