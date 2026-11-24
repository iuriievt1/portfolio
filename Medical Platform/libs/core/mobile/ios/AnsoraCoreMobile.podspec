require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AnsoraCoreMobile'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.author         = 'veevoy'
  s.homepage       = 'https://github.com/veevoy/ansora-vulna'
  s.source         = { git: 'https://github.com/veevoy/ansora-vulna.git' }
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Expo'

  s.source_files = '**/*.swift'
  s.exclude_files = 'Tests/**/*'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    'SWIFT_OPTIMIZATION_LEVEL' => '-O'
  }
end
