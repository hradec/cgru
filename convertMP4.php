<?php

include 'video.php';

$var_value = $_GET['f'];



$cmd="./convertMP4.py $var_value 2>&1";
$ret=exec($cmd);
$size = getimagesize($ret);
$bret=basename($ret);

// Set the content type header - in this case image/jpg
//header('Content-Type: image/jpeg', TRUE);
//header('Content-Length: '.filesize($ret));
header("Content-disposition: inline; filename=$bret");

print( "hradec<br>".$var_value."<br>" );
print("python:".$ret."<br>");

$stream = new VideoStream($ret);
$stream->start();

//readfile($ret);

if (strpos($ret, '/dev/shm/') !== false) {
//    exec('rm -rf ' . $ret . " & ");
}
exit;
?>
